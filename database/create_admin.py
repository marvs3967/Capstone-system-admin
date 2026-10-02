import importlib
import os

# =========================
# MYSQL CONFIGURATION
# (dapat tumugma sa DB_CONFIG sa app.py)
# =========================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "gym_admin")
}

# =========================
# ADMIN ACCOUNT DETAILS
# (pwede mong palitan ito)
# =========================

USERNAME = "admin"
EMAIL = "admin@example.com"
PASSWORD = "admin123"


def create_admin():

    try:
        generate_password_hash = importlib.import_module(
            "werkzeug.security"
        ).generate_password_hash
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "Werkzeug is not installed. Run: "
            "python -m pip install werkzeug"
        ) from exc

    hashed_password = generate_password_hash(PASSWORD)

    try:
        mysql_connector = importlib.import_module("mysql.connector")
    except ModuleNotFoundError as exc:
        raise RuntimeError(
            "The MySQL connector is not installed. Run: "
            "python -m pip install mysql-connector-python"
        ) from exc

    conn = mysql_connector.connect(**DB_CONFIG)
    cursor = conn.cursor()

    try:

        cursor.execute(
            "SELECT id FROM admins WHERE username = %s",
            (USERNAME,)
        )

        existing = cursor.fetchone()

        if existing:

            cursor.execute(
                """
                UPDATE admins
                SET password_hash = %s,
                    failed_attempts = 0,
                    locked_until = NULL
                WHERE username = %s
                """,
                (hashed_password, USERNAME)
            )

            conn.commit()

            print(f"Admin '{USERNAME}' already existed. Na-reset ang password nito!")
            print(f"Username: {USERNAME}")
            print(f"Password: {PASSWORD}")

            return

        cursor.execute(
            """
            INSERT INTO admins
            (username, email, password_hash, failed_attempts, locked_until)
            VALUES (%s, %s, %s, 0, NULL)
            """,
            (USERNAME, EMAIL, hashed_password)
        )

        conn.commit()

        print(f"Successfully created admin account!")
        print(f"Username: {USERNAME}")
        print(f"Password: {PASSWORD}")

    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    create_admin()
