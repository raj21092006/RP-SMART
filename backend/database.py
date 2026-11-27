
import sqlite3
from pathlib import Path

# Database file location
base_dir = Path(__file__).resolve().parent
db_path = base_dir / "rp_smart.db"


def get_connection():
    """Create a connection to SQLite database."""
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    """Create conversation, message and memory tables."""
    connection = get_connection()
    cursor = connection.cursor()

    # Conversations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT DEFAULT 'New Conversation',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id)
                REFERENCES conversations (id)
        )
    """)

    # Long-term memories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_key TEXT UNIQUE NOT NULL,
            memory_value TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()
    connection.close()


def create_conversation(title="New Conversation"):
    """Create a new chat session and return its ID."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "INSERT INTO conversations (title) VALUES (?)",
        (title,)
    )

    conversation_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return conversation_id


def save_message(conversation_id, role, content):
    """Save a user or assistant message."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        INSERT INTO messages (conversation_id, role, content)
        VALUES (?, ?, ?)
        """,
        (conversation_id, role, content)
    )

    message_id = cursor.lastrowid

    connection.commit()
    connection.close()

    return message_id


def get_messages(conversation_id):
    """Retrieve all messages from a conversation."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        SELECT role, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id ASC
        """,
        (conversation_id,)
    )

    messages = cursor.fetchall()
    connection.close()

    return [dict(message) for message in messages]


def get_conversations():
    """Retrieve all conversations."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id, title, created_at
        FROM conversations
        ORDER BY id DESC
    """)

    conversations = cursor.fetchall()
    connection.close()

    return [dict(conversation) for conversation in conversations]


def update_conversation_title(conversation_id, title):
    """Update conversation title."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        """
        UPDATE conversations
        SET title = ?
        WHERE id = ?
        """,
        (title, conversation_id)
    )

    connection.commit()
    connection.close()


def save_memory(memory_key, memory_value):
    """Save or update a long-term memory."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        INSERT INTO memories (memory_key, memory_value)
        VALUES (?, ?)
        ON CONFLICT(memory_key)
        DO UPDATE SET
            memory_value = excluded.memory_value,
            updated_at = CURRENT_TIMESTAMP
    """, (memory_key, memory_value))

    connection.commit()
    connection.close()


def get_memories():
    """Retrieve all long-term memories."""
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT memory_key, memory_value
        FROM memories
        ORDER BY id ASC
    """)

    memories = cursor.fetchall()
    connection.close()

    return [dict(memory) for memory in memories]
