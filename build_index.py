#!/usr/bin/env python3
"""
Script to pre-build the DuckDB index for faster deployment
"""
import duckdb
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def build_divisions_index():
    """Build the divisions index and save it to a database file"""
    try:
        # Connect to database file
        db_path = "./divisions_index.duckdb"

        # Remove existing database if it exists
        if os.path.exists(db_path):
            os.remove(db_path)
            logger.info(f"Removed existing database at {db_path}")

        db = duckdb.connect(db_path)
        logger.info(f"Created new database at {db_path}")

        # Install required extensions
        logger.info("Installing DuckDB extensions...")
        db.execute("INSTALL spatial;")
        db.execute("LOAD spatial;")
        db.execute("INSTALL httpfs;")
        db.execute("LOAD httpfs;")

        # Configure AWS settings for accessing Overture data
        db.execute("SET s3_region='us-west-2';")
        db.execute("SET s3_access_key_id='';")
        db.execute("SET s3_secret_access_key='';")

        logger.info("Creating lightweight divisions index (metadata only)...")

        # Create a lightweight table with just search metadata and IDs
        # Geometry will be fetched on-demand using the ID
        db.execute(
            """
            CREATE TABLE divisions_index AS 
            SELECT 
                id,
                CAST(names['primary'] AS VARCHAR) as name,
                UPPER(CAST(names['primary'] AS VARCHAR)) as name_upper,
                subtype,
                CAST(names['common'] AS VARCHAR) as common_name,
                country,
                bbox
            FROM read_parquet('s3://overturemaps-us-west-2/release/2025-06-25.0/theme=divisions/type=division_area/*.parquet')
            WHERE names['primary'] IS NOT NULL
            AND LENGTH(CAST(names['primary'] AS VARCHAR)) > 0
        """
        )

        logger.info("Creating indexes for faster searches...")

        # Create indexes for faster searches
        db.execute("CREATE INDEX idx_name ON divisions_index(name)")
        db.execute("CREATE INDEX idx_name_upper ON divisions_index(name_upper)")
        db.execute("CREATE INDEX idx_subtype ON divisions_index(subtype)")
        db.execute("CREATE INDEX idx_country ON divisions_index(country)")
        db.execute("CREATE INDEX idx_id ON divisions_index(id)")

        # Create compound index for common search patterns
        db.execute(
            "CREATE INDEX idx_name_subtype ON divisions_index(name_upper, subtype)"
        )

        row_count = db.execute("SELECT COUNT(*) FROM divisions_index").fetchone()[0]
        logger.info(
            f"Lightweight divisions index created successfully with {row_count} entries and 6 indexes"
        )

        # Get database file size
        file_size = os.path.getsize(db_path) / (1024 * 1024)  # Size in MB
        logger.info(f"Database file size: {file_size:.1f} MB (without geometry data)")

        db.close()
        logger.info(
            "Lightweight index build complete! Geometry will be fetched on-demand."
        )

    except Exception as e:
        logger.error(f"Failed to build index: {e}")
        raise


if __name__ == "__main__":
    build_divisions_index()
