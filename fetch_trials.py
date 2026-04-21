"""
Fetch ALL actively recruiting clinical trials from ClinicalTrials.gov API v2.
Stores complete raw JSON pages in data/raw/ and full trial data in SQLite.
"""

import json
import sqlite3
import time
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.parse import urlencode

API_BASE = "https://clinicaltrials.gov/api/v2/studies"
RAW_DIR = Path(__file__).parent / "data" / "raw"
DB_PATH = Path(__file__).parent / "data" / "trials.db"


def fetch_all_pages():
    """Paginate through all RECRUITING studies, saving each page to disk
    and yielding individual studies."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    page_token = None
    page_num = 0

    while True:
        params = {
            "filter.overallStatus": "RECRUITING",
            "pageSize": 100,
        }
        if page_token:
            params["pageToken"] = page_token

        url = f"{API_BASE}?{urlencode(params)}"
        req = Request(url, headers={"Accept": "application/json"})

        for attempt in range(5):
            try:
                with urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode())
                break
            except Exception as e:
                if attempt < 4:
                    wait = 2 ** attempt
                    print(f"  Retry {attempt + 1} after error: {e} (waiting {wait}s)")
                    time.sleep(wait)
                else:
                    raise

        studies = data.get("studies", [])
        if not studies:
            break

        page_num += 1
        total = data.get("totalCount", "?")
        print(f"Page {page_num}: got {len(studies)} studies (total: {total})")

        # Save the complete raw API response for this page
        page_path = RAW_DIR / f"page_{page_num:04d}.json"
        page_path.write_text(json.dumps(data, indent=2))

        for study in studies:
            yield study

        page_token = data.get("nextPageToken")
        if not page_token:
            break

        # Be polite to the API
        time.sleep(0.3)


def init_db():
    """Create SQLite tables."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS trials (
            nct_id TEXT PRIMARY KEY,
            brief_title TEXT,
            eligibility_criteria TEXT,
            eligibility_sex TEXT,
            minimum_age TEXT,
            maximum_age TEXT,
            conditions TEXT,
            phase TEXT,
            enrollment_count INTEGER,
            enrollment_type TEXT,
            raw_json TEXT
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS arms_interventions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nct_id TEXT,
            arm_group_label TEXT,
            arm_group_type TEXT,
            arm_description TEXT,
            intervention_type TEXT,
            intervention_name TEXT,
            intervention_description TEXT,
            FOREIGN KEY (nct_id) REFERENCES trials(nct_id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nct_id TEXT,
            facility TEXT,
            city TEXT,
            state TEXT,
            country TEXT,
            latitude REAL,
            longitude REAL,
            FOREIGN KEY (nct_id) REFERENCES trials(nct_id)
        )
    """)

    conn.commit()
    return conn


def insert_study(conn, study):
    """Extract fields from a study and insert into the database."""
    proto = study.get("protocolSection", {})
    ident = proto.get("identificationModule", {})
    nct_id = ident.get("nctId", "")
    brief_title = ident.get("briefTitle", "")

    elig = proto.get("eligibilityModule", {})
    eligibility_criteria = elig.get("eligibilityCriteria", "")
    eligibility_sex = elig.get("sex", "")
    minimum_age = elig.get("minimumAge", "")
    maximum_age = elig.get("maximumAge", "")

    conditions_mod = proto.get("conditionsModule", {})
    conditions = json.dumps(conditions_mod.get("conditions", []))

    design = proto.get("designModule", {})
    phases = design.get("phases", [])
    phase = ", ".join(phases) if phases else ""
    enrollment_info = design.get("enrollmentInfo", {})
    enrollment_count = enrollment_info.get("count")
    enrollment_type = enrollment_info.get("type", "")

    c = conn.cursor()
    c.execute(
        """INSERT OR REPLACE INTO trials
           (nct_id, brief_title, eligibility_criteria, eligibility_sex,
            minimum_age, maximum_age, conditions, phase,
            enrollment_count, enrollment_type, raw_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            nct_id, brief_title, eligibility_criteria, eligibility_sex,
            minimum_age, maximum_age, conditions, phase,
            enrollment_count, enrollment_type, json.dumps(study),
        ),
    )

    # Arms & Interventions
    arms_mod = proto.get("armsInterventionsModule", {})
    for arm in arms_mod.get("armGroups", []):
        c.execute(
            """INSERT INTO arms_interventions
               (nct_id, arm_group_label, arm_group_type, arm_description)
               VALUES (?, ?, ?, ?)""",
            (nct_id, arm.get("label", ""), arm.get("type", ""),
             arm.get("description", "")),
        )
    for intv in arms_mod.get("interventions", []):
        c.execute(
            """INSERT INTO arms_interventions
               (nct_id, intervention_type, intervention_name, intervention_description)
               VALUES (?, ?, ?, ?)""",
            (nct_id, intv.get("type", ""), intv.get("name", ""),
             intv.get("description", "")),
        )

    # Locations
    contacts_mod = proto.get("contactsLocationsModule", {})
    for loc in contacts_mod.get("locations", []):
        geo = loc.get("geoPoint", {})
        c.execute(
            """INSERT INTO locations
               (nct_id, facility, city, state, country, latitude, longitude)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                nct_id,
                loc.get("facility", ""),
                loc.get("city", ""),
                loc.get("state", ""),
                loc.get("country", ""),
                geo.get("lat"),
                geo.get("lon"),
            ),
        )


def main():
    print("Fetching all RECRUITING trials from ClinicalTrials.gov API v2...\n")

    # Collect all studies (pages saved to disk during iteration)
    all_studies = list(fetch_all_pages())
    print(f"\nTotal studies fetched: {len(all_studies)}")

    # Insert into SQLite
    print("\nBuilding SQLite database...")
    conn = init_db()

    # Clear old data before inserting fresh
    conn.execute("DELETE FROM locations")
    conn.execute("DELETE FROM arms_interventions")
    conn.execute("DELETE FROM trials")

    for i, study in enumerate(all_studies, 1):
        insert_study(conn, study)
        if i % 1000 == 0:
            conn.commit()
            print(f"  Inserted {i} studies...")

    conn.commit()

    # Summary
    c = conn.cursor()
    trial_count = c.execute("SELECT COUNT(*) FROM trials").fetchone()[0]
    loc_count = c.execute("SELECT COUNT(*) FROM locations").fetchone()[0]
    arm_count = c.execute("SELECT COUNT(*) FROM arms_interventions").fetchone()[0]
    conn.close()

    print(f"\nDone! Database: {DB_PATH}")
    print(f"  Trials:              {trial_count:,}")
    print(f"  Locations:           {loc_count:,}")
    print(f"  Arms/Interventions:  {arm_count:,}")


if __name__ == "__main__":
    main()
