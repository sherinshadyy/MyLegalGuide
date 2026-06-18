#!/usr/bin/env python
# -*- coding: utf-8 -*-

import json
import os
from pathlib import Path

import pymysql
from pymysql.cursors import DictCursor
from dotenv import load_dotenv

load_dotenv()

MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", 3306))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "mylegalguide")


def _create_connection(use_database: bool = True):
    conn_args = {
        "host": MYSQL_HOST,
        "port": MYSQL_PORT,
        "user": MYSQL_USER,
        "password": MYSQL_PASSWORD,
        "charset": "utf8mb4",
        "cursorclass": DictCursor,
        "autocommit": True,
    }
    if use_database:
        conn_args["database"] = MYSQL_DATABASE
    return pymysql.connect(**conn_args)


def _ensure_column(cur, table_name: str, column_name: str, definition_sql: str):
    cur.execute(
        """
        SELECT COUNT(*) AS cnt
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s AND COLUMN_NAME = %s
        """,
        (MYSQL_DATABASE, table_name, column_name),
    )
    if cur.fetchone()["cnt"] == 0:
        cur.execute(f"ALTER TABLE `{table_name}` ADD COLUMN {definition_sql}")


def init_db():
    with _create_connection(use_database=False) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{MYSQL_DATABASE}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
            )
    with _create_connection(use_database=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS rag_docs (
                    id VARCHAR(128) NOT NULL PRIMARY KEY,
                    source_ids JSON NOT NULL,
                    num_items INT NOT NULL,
                    content LONGTEXT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS user_answers (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    query LONGTEXT NOT NULL,
                    answer LONGTEXT NOT NULL,
                    chunks_used JSON NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    phone VARCHAR(64) NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    role VARCHAR(32) NOT NULL,
                    specialty VARCHAR(128) DEFAULT '',
                    description TEXT DEFAULT '',
                    profile_pic TEXT DEFAULT '',
                    gender VARCHAR(16) DEFAULT '',
                    consultation_fee INT DEFAULT NULL,
                    fee_min INT DEFAULT NULL,
                    fee_max INT DEFAULT NULL,
                    practice_details TEXT DEFAULT '',
                    availability TEXT DEFAULT '',
                    availability_slots JSON NOT NULL DEFAULT ('[]'),
                    documents JSON NOT NULL DEFAULT ('[]'),
                    lawyer_status VARCHAR(32) DEFAULT '',
                    is_active TINYINT(1) NOT NULL DEFAULT 1,
                    deleted_at DATETIME DEFAULT NULL,
                    location VARCHAR(255) DEFAULT '',
                    years_of_experience INT DEFAULT NULL,
                    consultation_duration INT DEFAULT NULL,
                    booking_options JSON NOT NULL DEFAULT ('[]'),
                    rejection_reason TEXT DEFAULT '',
                    rejection_at DATETIME DEFAULT NULL,
                    INDEX (phone)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            _ensure_column(cur, "users", "phone", "phone VARCHAR(64) NOT NULL DEFAULT ''")
            _ensure_column(cur, "users", "password", "password VARCHAR(255) NOT NULL DEFAULT ''")
            _ensure_column(cur, "users", "role", "role VARCHAR(32) NOT NULL DEFAULT 'User'")
            _ensure_column(cur, "users", "specialty", "specialty VARCHAR(128) DEFAULT ''")
            _ensure_column(cur, "users", "description", "description TEXT DEFAULT ''")
            _ensure_column(cur, "users", "profile_pic", "profile_pic TEXT DEFAULT ''")
            _ensure_column(cur, "users", "gender", "gender VARCHAR(16) DEFAULT ''")
            _ensure_column(cur, "users", "consultation_fee", "consultation_fee INT DEFAULT NULL")
            _ensure_column(cur, "users", "fee_min", "fee_min INT DEFAULT NULL")
            _ensure_column(cur, "users", "fee_max", "fee_max INT DEFAULT NULL")
            _ensure_column(cur, "users", "practice_details", "practice_details TEXT DEFAULT ''")
            _ensure_column(cur, "users", "availability", "availability TEXT DEFAULT ''")
            _ensure_column(cur, "users", "availability_slots", "availability_slots JSON NOT NULL DEFAULT ('[]')")
            _ensure_column(cur, "users", "documents", "documents JSON NOT NULL DEFAULT ('[]')")
            _ensure_column(cur, "users", "lawyer_status", "lawyer_status VARCHAR(32) DEFAULT ''")
            _ensure_column(cur, "users", "is_active", "is_active TINYINT(1) NOT NULL DEFAULT 1")
            _ensure_column(cur, "users", "deleted_at", "deleted_at DATETIME DEFAULT NULL")
            _ensure_column(cur, "users", "location", "location VARCHAR(255) DEFAULT ''")
            _ensure_column(cur, "users", "years_of_experience", "years_of_experience INT DEFAULT NULL")
            _ensure_column(cur, "users", "consultation_duration", "consultation_duration INT DEFAULT NULL")
            _ensure_column(cur, "users", "booking_options", "booking_options JSON NOT NULL DEFAULT ('[]')")
            _ensure_column(cur, "users", "rejection_reason", "rejection_reason TEXT DEFAULT ''")
            _ensure_column(cur, "users", "rejection_at", "rejection_at DATETIME DEFAULT NULL")

            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS admin_actions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    external_id VARCHAR(64) DEFAULT '',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    admin_email VARCHAR(255) NOT NULL,
                    action VARCHAR(128) NOT NULL,
                    target_email VARCHAR(255) DEFAULT '',
                    details TEXT DEFAULT ''
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS bookings (
                    id VARCHAR(64) NOT NULL PRIMARY KEY,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    lawyer VARCHAR(255) DEFAULT '',
                    lawyer_email VARCHAR(255) DEFAULT '',
                    name VARCHAR(255) DEFAULT '',
                    email VARCHAR(255) DEFAULT '',
                    date DATE DEFAULT NULL,
                    time VARCHAR(32) DEFAULT '',
                    note TEXT DEFAULT '',
                    meeting_type VARCHAR(64) DEFAULT '',
                    status VARCHAR(64) DEFAULT '',
                    messages JSON NOT NULL DEFAULT ('[]'),
                    acted_at DATETIME DEFAULT NULL,
                    chat_read_at JSON NOT NULL DEFAULT ('{}')
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            _ensure_column(cur, "admin_actions", "external_id", "external_id VARCHAR(64) DEFAULT ''")
            _ensure_column(cur, "bookings", "acted_at", "acted_at DATETIME DEFAULT NULL")
            _ensure_column(cur, "bookings", "chat_read_at", "chat_read_at JSON NOT NULL DEFAULT ('{}')")
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS ai_conversations (
                    id VARCHAR(64) NOT NULL PRIMARY KEY,
                    user_email VARCHAR(255) NOT NULL,
                    title VARCHAR(255) DEFAULT '',
                    messages JSON NOT NULL DEFAULT ('[]'),
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS lawyer_reviews (
                    id VARCHAR(64) NOT NULL PRIMARY KEY,
                    lawyer_email VARCHAR(255) NOT NULL,
                    user_email VARCHAR(255) NOT NULL,
                    user_name VARCHAR(255) DEFAULT '',
                    rating INT DEFAULT NULL,
                    comment TEXT DEFAULT '',
                    booking_id VARCHAR(64) DEFAULT '',
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS contacts (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    email VARCHAR(255) NOT NULL,
                    message TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    is_read TINYINT(1) NOT NULL DEFAULT 0,
                    INDEX idx_contacts_created (created_at DESC)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS app_meta (
                    meta_key VARCHAR(64) NOT NULL PRIMARY KEY,
                    meta_value TEXT NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )


def load_docstore_from_db():
    with _create_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, source_ids, num_items, content FROM rag_docs ORDER BY id")
            rows = cur.fetchall()
    docs = []
    for row in rows:
        source_ids = row.get("source_ids")
        if isinstance(source_ids, str):
            source_ids = json.loads(source_ids)
        docs.append(
            {
                "id": row["id"],
                "source_ids": source_ids or [],
                "num_items": int(row["num_items"] or 0),
                "content": row["content"],
            }
        )
    return docs


def sync_json_docstore_to_db(docstore_path):
    path = Path(docstore_path)
    if not path.exists():
        raise FileNotFoundError(f"Missing docstore file: {path}")

    docs = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(docs, list) or len(docs) == 0:
        return 0

    with _create_connection() as conn:
        with conn.cursor() as cur:
            for doc in docs:
                cur.execute(
                    """
                    INSERT INTO rag_docs (id, source_ids, num_items, content)
                    VALUES (%s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE source_ids = VALUES(source_ids), num_items = VALUES(num_items), content = VALUES(content)
                    """,
                    (
                        doc.get("id"),
                        json.dumps(doc.get("source_ids", []), ensure_ascii=False),
                        int(doc.get("num_items", 0)),
                        doc.get("content", ""),
                    ),
                )
    return len(docs)


def save_user_answer(record):
    if not isinstance(record, dict):
        return False
    with _create_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO user_answers (query, answer, chunks_used) VALUES (%s, %s, %s)",
                (
                    record.get("query", ""),
                    record.get("answer", ""),
                    json.dumps(record.get("chunks_used", []), ensure_ascii=False),
                ),
            )
    return True


def sync_frontend_data_to_db(frontend_path=None):
    if frontend_path is None:
        frontend_path = Path(__file__).resolve().parents[1] / "frontend" / "legalguide-data.json"
    frontend_path = Path(frontend_path)
    if not frontend_path.exists():
        return 0

    data = json.loads(frontend_path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return 0

    user_count = 0
    admin_count = 0
    booking_count = 0
    conv_count = 0
    review_count = 0

    with _create_connection() as conn:
        with conn.cursor() as cur:
            for user in data.get("users", []):
                cur.execute(
                    """
                    INSERT INTO users (
                        created_at, name, email, phone, password, role, specialty, description, profile_pic,
                        gender, consultation_fee, fee_min, fee_max, practice_details, availability,
                        availability_slots, documents, lawyer_status, is_active, deleted_at,
                        location, years_of_experience, consultation_duration, booking_options,
                        rejection_reason, rejection_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        name = VALUES(name), phone = VALUES(phone), password = VALUES(password),
                        role = VALUES(role), specialty = VALUES(specialty), description = VALUES(description),
                        profile_pic = VALUES(profile_pic), gender = VALUES(gender), consultation_fee = VALUES(consultation_fee),
                        fee_min = VALUES(fee_min), fee_max = VALUES(fee_max), practice_details = VALUES(practice_details),
                        availability = VALUES(availability), availability_slots = VALUES(availability_slots),
                        documents = VALUES(documents), lawyer_status = VALUES(lawyer_status), is_active = VALUES(is_active),
                        deleted_at = VALUES(deleted_at), location = VALUES(location), years_of_experience = VALUES(years_of_experience),
                        consultation_duration = VALUES(consultation_duration), booking_options = VALUES(booking_options),
                        rejection_reason = VALUES(rejection_reason), rejection_at = VALUES(rejection_at)
                    """,
                    (
                        user.get("createdAt", None),
                        user.get("name", ""),
                        user.get("email", ""),
                        user.get("phone", ""),
                        user.get("password", ""),
                        user.get("role", "User"),
                        user.get("specialty", ""),
                        user.get("description", ""),
                        user.get("profilePic", ""),
                        user.get("gender", ""),
                        user.get("consultationFee", None),
                        user.get("feeMin", None),
                        user.get("feeMax", None),
                        user.get("practiceDetails", ""),
                        user.get("availability", ""),
                        json.dumps(user.get("availabilitySlots", []), ensure_ascii=False),
                        json.dumps(user.get("documents", []), ensure_ascii=False),
                        user.get("lawyerStatus", ""),
                        1 if user.get("isActive", True) else 0,
                        user.get("deletedAt", None),
                        user.get("location", ""),
                        user.get("yearsOfExperience", None),
                        user.get("consultationDuration", None),
                        json.dumps(user.get("bookingOptions", []), ensure_ascii=False),
                        user.get("rejectionReason", ""),
                        user.get("rejectionAt", None),
                    ),
                )
                user_count += 1

            for action in data.get("adminActions", []):
                cur.execute(
                    """
                    INSERT INTO admin_actions (external_id, admin_email, action, target_email, details, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        action.get("id", ""),
                        action.get("adminEmail", ""),
                        action.get("action", ""),
                        action.get("targetEmail", ""),
                        action.get("details", ""),
                        action.get("at", None),
                    ),
                )
                admin_count += 1

            for book in data.get("bookings", []):
                cur.execute(
                    """
                    INSERT INTO bookings (id, lawyer, lawyer_email, name, email, date, time, note, meeting_type, status, messages, created_at, acted_at, chat_read_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        lawyer = VALUES(lawyer), lawyer_email = VALUES(lawyer_email),
                        name = VALUES(name), email = VALUES(email), date = VALUES(date),
                        time = VALUES(time), note = VALUES(note), meeting_type = VALUES(meeting_type),
                        status = VALUES(status), messages = VALUES(messages), acted_at = VALUES(acted_at),
                        chat_read_at = VALUES(chat_read_at)
                    """,
                    (
                        book.get("id", ""),
                        book.get("lawyer", ""),
                        book.get("lawyerEmail", ""),
                        book.get("name", ""),
                        book.get("email", ""),
                        book.get("date", None),
                        book.get("time", ""),
                        book.get("note", ""),
                        book.get("meetingType", ""),
                        book.get("status", ""),
                        json.dumps(book.get("messages", []), ensure_ascii=False),
                        book.get("createdAt", None),
                        book.get("actedAt", None),
                        json.dumps(book.get("chatReadAt", {}), ensure_ascii=False),
                    ),
                )
                booking_count += 1

            for conv in data.get("aiConversations", []):
                cur.execute(
                    """
                    INSERT INTO ai_conversations (id, user_email, title, messages, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        user_email = VALUES(user_email), title = VALUES(title),
                        messages = VALUES(messages), updated_at = VALUES(updated_at)
                    """,
                    (
                        conv.get("id", ""),
                        conv.get("userEmail", ""),
                        conv.get("title", ""),
                        json.dumps(conv.get("messages", []), ensure_ascii=False),
                        conv.get("createdAt", None),
                        conv.get("updatedAt", None),
                    ),
                )
                conv_count += 1

            for review in data.get("lawyerReviews", []):
                cur.execute(
                    """
                    INSERT INTO lawyer_reviews (id, lawyer_email, user_email, user_name, rating, comment, booking_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                        lawyer_email = VALUES(lawyer_email), user_email = VALUES(user_email),
                        user_name = VALUES(user_name), rating = VALUES(rating),
                        comment = VALUES(comment), booking_id = VALUES(booking_id),
                        updated_at = VALUES(updated_at)
                    """,
                    (
                        review.get("id", ""),
                        review.get("lawyerEmail", ""),
                        review.get("userEmail", ""),
                        review.get("userName", ""),
                        review.get("rating", None),
                        review.get("comment", ""),
                        review.get("bookingId", ""),
                        review.get("createdAt", None),
                        review.get("updatedAt", None),
                    ),
                )
                review_count += 1

    return {
        "users": user_count,
        "admin_actions": admin_count,
        "bookings": booking_count,
        "ai_conversations": conv_count,
        "lawyer_reviews": review_count,
    }
