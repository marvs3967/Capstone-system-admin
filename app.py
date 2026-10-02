# pyright: reportMissingImports=false
try:
    from flask import Flask, render_template, request, jsonify, session  # type: ignore[reportMissingImports]
except ImportError as exc:
    raise ImportError(
        "Flask is required to run this application. Install it with: pip install Flask"
    ) from exc
import mysql.connector
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
import secrets
import os

app = Flask(__name__)

app.secret_key = os.getenv(
    "SECRET_KEY",
    "CHANGE_THIS_SECRET_KEY"
)

app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# =========================
# MYSQL CONFIGURATION
# =========================

DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "3306")),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "gym_admin")
}

# =========================
# LOGIN SECURITY
# =========================

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_MINUTES = 3


def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def login_required(function):
    @wraps(function)
    def wrapper(*args, **kwargs):

        if not session.get("admin_id"):
            return jsonify({
                "success": False,
                "message": "Please login first."
            }), 401

        return function(*args, **kwargs)

    return wrapper


# =========================
# HOME
# =========================

@app.route("/")
def home():
    return render_template("index.html")


# =========================
# LOGIN
# =========================

@app.route("/api/login", methods=["POST"])
def login():

    data = request.get_json()

    username = str(data.get("username", "")).strip()
    password = str(data.get("password", ""))

    if not username or not password:
        return jsonify({
            "success": False,
            "message": "Username and password are required."
        }), 400

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:

        cursor.execute(
            """
            SELECT *
            FROM admins
            WHERE username = %s
            LIMIT 1
            """,
            (username,)
        )

        admin = cursor.fetchone()

        if not admin:

            return jsonify({
                "success": False,
                "message": "Invalid username or password."
            }), 401

        now = datetime.now()

        # =========================
        # CHECK LOCKOUT
        # =========================

        if (
            admin["locked_until"]
            and admin["locked_until"] > now
        ):

            remaining = int(
                (
                    admin["locked_until"] - now
                ).total_seconds()
            )

            return jsonify({
                "success": False,
                "locked": True,
                "remaining_seconds": remaining,
                "message": "Account temporarily locked."
            }), 429

        # =========================
        # RESET EXPIRED LOCK
        # =========================

        if (
            admin["locked_until"]
            and admin["locked_until"] <= now
        ):

            cursor.execute(
                """
                UPDATE admins
                SET failed_attempts = 0,
                    locked_until = NULL
                WHERE id = %s
                """,
                (admin["id"],)
            )

            conn.commit()

            admin["failed_attempts"] = 0

        # =========================
        # CHECK PASSWORD
        # =========================

        if check_password_hash(admin["password_hash"], password):
            cursor.execute(
                """
                UPDATE admins
                SET failed_attempts = 0, locked_until = NULL
                WHERE id = %s
                """,
                (admin["id"],)
            )
            conn.commit()

            session.clear()
            session["admin_id"] = admin["id"]
            session["admin_username"] = admin["username"]

            today = datetime.now().date()
            cursor.execute(
                """
                SELECT id
                FROM admin_attendance
                WHERE admin_id = %s AND attendance_date = %s
                ORDER BY id DESC LIMIT 1
                """,
                (admin["id"], today)
            )
            attendance = cursor.fetchone()

            if not attendance:
                cursor.execute(
                    """
                    INSERT INTO admin_attendance (admin_id, time_in, attendance_date)
                    VALUES (%s, NOW(), %s)
                    """,
                    (admin["id"], today)
                )
                conn.commit()
                time_in_message = "Automatic Time In recorded."
            else:
                time_in_message = "Today's Time In already exists."

            return jsonify({
                "success": True,
                "message": "Login successful. " + time_in_message,
                "admin": {
                    "id": admin["id"],
                    "username": admin["username"],
                    "email": admin["email"]
                }
            })

        # =========================
        # WRONG PASSWORD
        # =========================

        attempts = admin["failed_attempts"] + 1

        if attempts >= MAX_LOGIN_ATTEMPTS:

            locked_until = (
                now +
                timedelta(
                    minutes=LOCKOUT_MINUTES
                )
            )

            cursor.execute(
                """
                UPDATE admins
                SET failed_attempts = %s,
                    locked_until = %s
                WHERE id = %s
                """,
                (
                    attempts,
                    locked_until,
                    admin["id"]
                )
            )

            conn.commit()

            return jsonify({
                "success": False,
                "locked": True,
                "remaining_seconds":
                    LOCKOUT_MINUTES * 60,
                "message":
                    "Too many failed attempts. "
                    "Account locked for 3 minutes."
            }), 429

        cursor.execute(
            """
            UPDATE admins
            SET failed_attempts = %s
            WHERE id = %s
            """,
            (
                attempts,
                admin["id"]
            )
        )

        conn.commit()

        return jsonify({
            "success": False,
            "locked": False,
            "remaining_attempts":
                MAX_LOGIN_ATTEMPTS - attempts,
            "message":
                "Invalid username or password."
        }), 401

    finally:

        cursor.close()
        conn.close()


# =========================
# LOGOUT + AUTOMATIC TIME OUT
# =========================

@app.route("/api/logout", methods=["POST"])
def logout():

    admin_id = session.get("admin_id")

    if admin_id:

        conn = get_db()
        cursor = conn.cursor()

        try:

            today = datetime.now().date()

            cursor.execute(
                """
                UPDATE admin_attendance

                SET time_out = NOW()

                WHERE admin_id = %s

                AND attendance_date = %s

                AND time_out IS NULL

                ORDER BY id DESC

                LIMIT 1
                """,
                (
                    admin_id,
                    today
                )
            )

            conn.commit()

        finally:

            cursor.close()
            conn.close()

    # Destroy login session
    session.clear()

    return jsonify({
        "success": True,
        "message":
            "Logged out. Time Out recorded."
    })


# =========================
# SESSION
# =========================

@app.route("/api/session")
def check_session():

    if not session.get("admin_id"):

        return jsonify({
            "logged_in": False
        })

    return jsonify({
        "logged_in": True,
        "admin": {
            "id": session["admin_id"],
            "username": session["admin_username"]
        }
    })


# =========================
# DASHBOARD
# =========================

@app.route("/api/dashboard")
@login_required
def dashboard():

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:

        cursor.execute(
            "SELECT COUNT(*) AS total FROM members"
        )

        total_members = cursor.fetchone()["total"]

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM members
            WHERE status = 'Active'
            """
        )

        active_members = cursor.fetchone()["total"]

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM members
            WHERE membership_end
            BETWEEN CURDATE()
            AND DATE_ADD(
                CURDATE(),
                INTERVAL 7 DAY
            )
            """
        )

        expiring = cursor.fetchone()["total"]

        cursor.execute(
            """
            SELECT COALESCE(
                SUM(amount), 0
            ) AS total
            FROM sales
            """
        )

        total_sales = float(
            cursor.fetchone()["total"]
        )

        return jsonify({

            "success": True,

            "stats": {

                "members": total_members,

                "active": active_members,

                "expired":
                    total_members -
                    active_members,

                "expiring": expiring,

                "sales": total_sales
            }
        })

    finally:

        cursor.close()
        conn.close()


# =========================
# GET MEMBERS
# =========================

@app.route("/api/members", methods=["GET"])
@login_required
def get_members():

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:

        cursor.execute(
            """
            SELECT *
            FROM members
            ORDER BY id DESC
            """
        )

        members = cursor.fetchall()

        for member in members:

            for field in [
                "membership_start",
                "membership_end",
                "created_at"
            ]:

                if member.get(field):
                    member[field] = str(
                        member[field]
                    )

        return jsonify({
            "success": True,
            "members": members
        })

    finally:

        cursor.close()
        conn.close()


# =========================
# ADD MEMBER
# =========================

@app.route("/api/members", methods=["POST"])
@login_required
def add_member():

    data = request.get_json()

    required_fields = [
        "full_name",
        "membership_plan",
        "membership_start",
        "membership_end"
    ]

    for field in required_fields:

        if not data.get(field):

            return jsonify({
                "success": False,
                "message":
                    "Please complete all required fields."
            }), 400

    conn = get_db()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            INSERT INTO members
            (
                full_name,
                email,
                phone,
                membership_plan,
                membership_start,
                membership_end,
                status
            )
            VALUES
            (
                %s,%s,%s,%s,%s,%s,%s
            )
            """,
            (
                data["full_name"],
                data.get("email", ""),
                data.get("phone", ""),
                data["membership_plan"],
                data["membership_start"],
                data["membership_end"],
                data.get("status", "Active")
            )
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Member added successfully."
        }), 201

    finally:

        cursor.close()
        conn.close()


# =========================
# DELETE MEMBER
# =========================

@app.route(
    "/api/members/<int:member_id>",
    methods=["DELETE"]
)
@login_required
def delete_member(member_id):

    conn = get_db()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            DELETE FROM members
            WHERE id = %s
            """,
            (member_id,)
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Member deleted."
        })

    finally:

        cursor.close()
        conn.close()


# =========================
# GET SALES
# =========================

@app.route("/api/sales", methods=["GET"])
@login_required
def get_sales():

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:

        cursor.execute(
            """
            SELECT
                s.id,
                s.plan_name,
                s.amount,
                s.payment_method,
                s.sale_date,
                m.full_name

            FROM sales s

            LEFT JOIN members m
            ON s.member_id = m.id

            ORDER BY
                s.sale_date DESC
            """
        )

        sales = cursor.fetchall()

        for sale in sales:

            if sale.get("sale_date"):
                sale["sale_date"] = str(
                    sale["sale_date"]
                )

        return jsonify({
            "success": True,
            "sales": sales
        })

    finally:

        cursor.close()
        conn.close()


# =========================
# ADD SALE
# =========================

@app.route("/api/sales", methods=["POST"])
@login_required
def add_sale():

    data = request.get_json()

    if (
        not data.get("plan_name")
        or data.get("amount") is None
    ):

        return jsonify({
            "success": False,
            "message":
                "Plan and amount are required."
        }), 400

    conn = get_db()
    cursor = conn.cursor()

    try:

        cursor.execute(
            """
            INSERT INTO sales
            (
                member_id,
                plan_name,
                amount,
                payment_method
            )
            VALUES
            (%s,%s,%s,%s)
            """,
            (
                data.get("member_id"),
                data["plan_name"],
                float(data["amount"]),
                data.get(
                    "payment_method",
                    "Cash"
                )
            )
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Sale added."
        }), 201

    finally:

        cursor.close()
        conn.close()


# =========================
# FORGOT PASSWORD
# =========================

@app.route(
    "/api/forgot-password",
    methods=["POST"]
)
def forgot_password():

    data = request.get_json()

    email = str(
        data.get("email", "")
    ).strip()

    if not email:

        return jsonify({
            "success": False,
            "message": "Email is required."
        }), 400

    conn = get_db()
    cursor = conn.cursor(
        dictionary=True
    )

    try:

        cursor.execute(
            """
            SELECT id
            FROM admins
            WHERE email = %s
            LIMIT 1
            """,
            (email,)
        )

        admin = cursor.fetchone()

        if not admin:

            return jsonify({
                "success": True,
                "message":
                    "If the email exists, "
                    "a reset request was created."
            })

        token = secrets.token_urlsafe(32)

        expires = (
            datetime.now() +
            timedelta(minutes=15)
        )

        cursor2 = conn.cursor()

        cursor2.execute(
            """
            INSERT INTO password_resets
            (
                admin_id,
                token,
                expires_at
            )
            VALUES
            (%s,%s,%s)
            """,
            (
                admin["id"],
                token,
                expires
            )
        )

        conn.commit()

        cursor2.close()

        return jsonify({
            "success": True,
            "message":
                "Reset request created.",
            "demo_token": token
        })

    finally:

        cursor.close()
        conn.close()


# =========================
# RESET PASSWORD
# =========================

@app.route(
    "/api/reset-password",
    methods=["POST"]
)
def reset_password():

    data = request.get_json()

    token = str(
        data.get("token", "")
    )

    new_password = str(
        data.get("new_password", "")
    )

    if (
        not token
        or len(new_password) < 8
    ):

        return jsonify({
            "success": False,
            "message":
                "Token and password "
                "with at least 8 characters "
                "are required."
        }), 400

    conn = get_db()
    cursor = conn.cursor(
        dictionary=True
    )

    try:

        cursor.execute(
            """
            SELECT *
            FROM password_resets
            WHERE token = %s
            AND used = 0
            AND expires_at > NOW()
            LIMIT 1
            """,
            (token,)
        )

        reset = cursor.fetchone()

        if not reset:

            return jsonify({
                "success": False,
                "message":
                    "Invalid or expired token."
            }), 400

        hashed_password = (
            generate_password_hash(
                new_password
            )
        )

        cursor.execute(
            """
            UPDATE admins
            SET password_hash = %s,
                failed_attempts = 0,
                locked_until = NULL
            WHERE id = %s
            """,
            (
                hashed_password,
                reset["admin_id"]
            )
        )

        cursor.execute(
            """
            UPDATE password_resets
            SET used = 1
            WHERE id = %s
            """,
            (reset["id"],)
        )

        conn.commit()

        return jsonify({
            "success": True,
            "message":
                "Password changed successfully."
        })

    finally:

        cursor.close()
        conn.close()


# =========================
# ADMIN ATTENDANCE HISTORY
# =========================

@app.route("/api/admin/attendance/history", methods=["GET"])
@login_required
def attendance_history():

    admin_id = session["admin_id"]

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("""
            SELECT
                attendance_date,
                time_in,
                time_out
            FROM admin_attendance
            WHERE admin_id = %s
            ORDER BY attendance_date DESC, id DESC
            LIMIT 30
        """, (admin_id,))

        records = cursor.fetchall()

        history = []

        for record in records:

            history.append({
                "date": (
                    record["attendance_date"].strftime("%B %d, %Y")
                    if record["attendance_date"]
                    else "—"
                ),

                "time_in": (
                    record["time_in"].strftime("%I:%M:%S %p")
                    if record["time_in"]
                    else "—"
                ),

                "time_out": (
                    record["time_out"].strftime("%I:%M:%S %p")
                    if record["time_out"]
                    else "—"
                ),

                "status": (
                    "Completed"
                    if record["time_out"]
                    else "Currently Logged In"
                )
            })

        return jsonify({
            "success": True,
            "history": history
        })

    except Exception as e:

        print("ATTENDANCE HISTORY ERROR:", e)

        return jsonify({
            "success": False,
            "message": str(e)
        }), 500

    finally:
        cursor.close()
        conn.close()

    
# =========================
# REPORTS
# =========================

@app.route("/api/reports", methods=["GET"])
@login_required
def get_reports():

    conn = get_db()
    cursor = conn.cursor(dictionary=True)

    try:

        # -------------------------
        # SUMMARY
        # -------------------------

        cursor.execute("""
            SELECT COUNT(*) AS total_members
            FROM members
        """)

        total_members = cursor.fetchone()["total_members"] or 0


        cursor.execute("""
            SELECT COUNT(*) AS active_members
            FROM members
            WHERE status = 'Active'
        """)

        active_members = cursor.fetchone()["active_members"] or 0


        cursor.execute("""
            SELECT COUNT(*) AS expired_members
            FROM members
            WHERE status = 'Expired'
        """)

        expired_members = cursor.fetchone()["expired_members"] or 0


        cursor.execute("""
            SELECT COALESCE(SUM(amount), 0) AS total_sales
            FROM sales
        """)

        total_sales = cursor.fetchone()["total_sales"] or 0


        # -------------------------
        # SALES BY MEMBERSHIP PLAN
        # -------------------------

        cursor.execute("""
            SELECT
                plan_name,
                COUNT(*) AS transactions,
                COALESCE(SUM(amount), 0) AS total
            FROM sales
            GROUP BY plan_name
            ORDER BY total DESC
        """)

        sales_by_plan = cursor.fetchall()


        # -------------------------
        # SALES BY PAYMENT METHOD
        # -------------------------

        cursor.execute("""
            SELECT
                payment_method,
                COUNT(*) AS transactions,
                COALESCE(SUM(amount), 0) AS total
            FROM sales
            GROUP BY payment_method
            ORDER BY total DESC
        """)

        sales_by_payment = cursor.fetchall()


        # -------------------------
        # RECENT TRANSACTIONS
        # -------------------------

        cursor.execute("""
            SELECT
                COALESCE(m.full_name, 'Walk-in') AS full_name,
                s.plan_name,
                s.amount,
                s.payment_method,
                DATE_FORMAT(
                    s.sale_date,
                    '%Y-%m-%d %h:%i %p'
                ) AS sale_date

            FROM sales s

            LEFT JOIN members m
                ON s.member_id = m.id

            ORDER BY s.sale_date DESC

            LIMIT 20
        """)

        recent_sales = cursor.fetchall()


        # -------------------------
        # CONVERT DECIMAL
        # -------------------------

        for item in sales_by_plan:
            item["total"] = float(item["total"])

        for item in sales_by_payment:
            item["total"] = float(item["total"])

        for item in recent_sales:
            item["amount"] = float(item["amount"])


        # -------------------------
        # RESPONSE
        # -------------------------

        return jsonify({

            "success": True,

            "summary": {
                "total_members": total_members,
                "active_members": active_members,
                "expired_members": expired_members,
                "total_sales": float(total_sales)
            },

            "sales_by_plan":
                sales_by_plan,

            "sales_by_payment":
                sales_by_payment,

            "recent_sales":
                recent_sales
        })


    except Exception as e:

        print(
            "REPORTS ERROR:",
            e
        )

        return jsonify({

            "success": False,

            "message": str(e)

        }), 500


    finally:

        cursor.close()
        conn.close()
        
if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=True
    )