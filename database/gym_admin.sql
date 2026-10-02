CREATE DATABASE IF NOT EXISTS gym_admin
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE gym_admin;


-- =========================
-- ADMINS
-- =========================

CREATE TABLE IF NOT EXISTS admins (

    id INT AUTO_INCREMENT PRIMARY KEY,

    username VARCHAR(50)
        UNIQUE NOT NULL,

    email VARCHAR(150)
        UNIQUE NOT NULL,

    password_hash VARCHAR(255)
        NOT NULL,

    failed_attempts INT
        NOT NULL DEFAULT 0,

    locked_until DATETIME
        NULL,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


-- =========================
-- MEMBERS
-- =========================

CREATE TABLE IF NOT EXISTS members (

    id INT AUTO_INCREMENT PRIMARY KEY,

    full_name VARCHAR(150)
        NOT NULL,

    email VARCHAR(150),

    phone VARCHAR(30),

    membership_plan VARCHAR(100)
        NOT NULL,

    membership_start DATE
        NOT NULL,

    membership_end DATE
        NOT NULL,

    status ENUM(
        'Active',
        'Expired',
        'Expiring'
    )
    DEFAULT 'Active',

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP

);


-- =========================
-- SALES
-- =========================

CREATE TABLE IF NOT EXISTS sales (

    id INT AUTO_INCREMENT PRIMARY KEY,

    member_id INT NULL,

    plan_name VARCHAR(100)
        NOT NULL,

    amount DECIMAL(10,2)
        NOT NULL,

    payment_method VARCHAR(50)
        DEFAULT 'Cash',

    sale_date TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (
        member_id
    )
    REFERENCES members(id)

    ON DELETE SET NULL

);


-- =========================
-- PASSWORD RESETS
-- =========================

CREATE TABLE IF NOT EXISTS password_resets (

    id INT AUTO_INCREMENT PRIMARY KEY,

    admin_id INT
        NOT NULL,

    token VARCHAR(255)
        UNIQUE NOT NULL,

    expires_at DATETIME
        NOT NULL,

    used TINYINT(1)
        DEFAULT 0,

    created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (
        admin_id
    )
    REFERENCES admins(id)

    ON DELETE CASCADE

);


-- =========================
-- SAMPLE MEMBERS
-- =========================

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
    'Juan Dela Cruz',
    'juan@gmail.com',
    '09123456789',
    'Monthly',
    CURDATE(),
    DATE_ADD(
        CURDATE(),
        INTERVAL 30 DAY
    ),
    'Active'
),

(
    'Mark Santos',
    'mark@gmail.com',
    '09123456788',
    '3 Months',
    CURDATE(),
    DATE_ADD(
        CURDATE(),
        INTERVAL 90 DAY
    ),
    'Active'
),

(
    'Pedro Garcia',
    'pedro@gmail.com',
    '09123456787',
    'Monthly',
    DATE_SUB(
        CURDATE(),
        INTERVAL 20 DAY
    ),
    DATE_ADD(
        CURDATE(),
        INTERVAL 5 DAY
    ),
    'Expiring'

    USE gym_admin;

CREATE TABLE IF NOT EXISTS admin_attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,

    admin_id INT NOT NULL,

    time_in DATETIME NOT NULL,

    time_out DATETIME NULL,

    attendance_date DATE NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (admin_id)
        REFERENCES admins(id)
        ON DELETE CASCADE
);
