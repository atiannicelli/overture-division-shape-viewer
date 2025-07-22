from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import duckdb
import json
import os
import requests
import urllib.parse
from typing import List, Dict, Any, Optional
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OvertureDataService:
    def __init__(self):
        self.db = None
        self.setup_database()

    def setup_database(self):
        """Initialize DuckDB connection with persistent database and indexes"""
        try:
            # Use persistent database file
            db_path = os.environ.get("DUCKDB_PATH", "./divisions_index.duckdb")
            self.db = duckdb.connect(db_path)

            # Install spatial extension for geometry operations
            self.db.execute("INSTALL spatial;")
            self.db.execute("LOAD spatial;")

            # Install httpfs for reading remote parquet files
            self.db.execute("INSTALL httpfs;")
            self.db.execute("LOAD httpfs;")

            # Configure AWS settings for accessing Overture data
            self.db.execute("SET s3_region='us-west-2';")
            self.db.execute("SET s3_access_key_id='';")
            self.db.execute("SET s3_secret_access_key='';")

            # Verify the pre-built index table exists
            self._verify_divisions_index()

            logger.info("Database setup with pre-built indexing completed successfully")
        except Exception as e:
            logger.error(f"Database setup failed: {e}")
            # Don't raise the exception, just log it and continue with mock data
            self.db = None

    def _verify_divisions_index(self):
        """Verify the pre-built divisions index table exists"""
        try:
            # Check if database is available
            if not self.db:
                raise Exception("Database connection not available")

            # Check if index table exists
            table_exists = self.db.execute(
                """
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_name = 'divisions_index'
            """
            ).fetchone()[0]

            if table_exists == 0:
                raise Exception(
                    "Pre-built divisions index table not found! The Docker image should contain a pre-built index."
                )
            else:
                # Log the number of entries in the pre-built index
                row_count = self.db.execute(
                    "SELECT COUNT(*) FROM divisions_index"
                ).fetchone()[0]
                logger.info(f"Using pre-built divisions index with {row_count} entries")

        except Exception as e:
            logger.error(f"Error verifying pre-built divisions index: {e}")
            raise

    def search_divisions(
        self,
        query: str,
        filters: Dict[str, bool],
        bbox: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        """Search for divisions in Overture Maps data"""
        try:
            # Query actual Overture Maps data only - no mock data fallback
            results = self._query_overture_data(query, filters, bbox)
            logger.info(f"Found {len(results)} results from Overture Maps data")
            return results

        except Exception as e:
            logger.error(f"Search failed: {e}")
            # Fallback to Nominatim if Overture fails
            try:
                results = self._query_nominatim_data(query, filters, bbox)
                logger.info(f"Found {len(results)} results from Nominatim fallback")
                return results
            except Exception as fallback_error:
                logger.error(f"Nominatim fallback also failed: {fallback_error}")
                return []

    def _query_overture_data(
        self,
        query: str,
        filters: Dict[str, bool],
        bbox: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        """Query indexed divisions data for fast searches"""
        try:
            # Check if database is available
            if not self.db:
                raise Exception("Database connection not available")

            # Use indexed table for much faster queries
            metadata_query = """
            SELECT 
                id,
                name,
                subtype,
                common_name,
                country,
                bbox
            FROM divisions_index
            WHERE name_upper LIKE ?
            """

            params = [f"%{query.upper()}%"]

            # Add spatial filtering if bbox is provided
            if bbox:
                # Convert bbox to spatial filter - check if the feature's bbox intersects with the viewport bbox
                metadata_query += """
                AND bbox IS NOT NULL
                AND bbox['xmin'] <= ?
                AND bbox['xmax'] >= ?
                AND bbox['ymin'] <= ?
                AND bbox['ymax'] >= ?
                """
                params.extend(
                    [bbox["east"], bbox["west"], bbox["north"], bbox["south"]]
                )
                logger.info(f"Applying spatial filter: {bbox}")

            # Add simple subtype filters
            if not (
                filters.get("city", True)
                and filters.get("state", True)
                and filters.get("county", True)
            ):
                subtype_conditions = []
                if filters.get("city", True):
                    subtype_conditions.append("subtype = 'locality'")
                if filters.get("state", True):
                    subtype_conditions.append("subtype IN ('region', 'country')")
                if filters.get("county", True):
                    subtype_conditions.append("subtype = 'county'")

                if subtype_conditions:
                    metadata_query += f" AND ({' OR '.join(subtype_conditions)})"

            metadata_query += " ORDER BY name LIMIT 20"

            logger.info(
                f"Executing indexed query for '{query}' with spatial filter: {bbox is not None}"
            )

            # Execute the parameterized query
            metadata_results = self.db.execute(metadata_query, params).fetchall()

            # Convert results to the expected format
            formatted_results = []
            for row in metadata_results:
                try:
                    # Determine type based on subtype
                    subtype = row[2] or ""

                    if subtype == "locality":
                        type_name = "city"
                    elif subtype == "county":
                        type_name = "county"
                    elif subtype in ["region", "country"]:
                        type_name = "state"
                    else:
                        type_name = "region"

                    # Map subtype to a reasonable admin level for compatibility
                    admin_level_map = {
                        "locality": 8,
                        "county": 6,
                        "region": 4,
                        "country": 2,
                    }
                    admin_level = admin_level_map.get(subtype, 0)

                    # Create result without geometry initially
                    formatted_result = {
                        "id": row[0] or f"overture_{len(formatted_results)}",
                        "name": row[1] or row[3] or "Unknown",
                        "type": type_name,
                        "region": f"{row[4] or 'Unknown'}",
                        "country": row[4] or "Unknown",
                        "admin_level": admin_level,
                        "population": None,  # Population not available in divisions data
                        "geometry": None,  # Will be fetched separately if needed
                    }
                    formatted_results.append(formatted_result)
                except Exception as row_error:
                    logger.warning(f"Error processing metadata row: {row_error}")
                    continue

            logger.info(
                f"Successfully processed {len(formatted_results)} metadata results from Overture Maps"
            )
            return formatted_results

        except Exception as e:
            logger.error(f"Overture Maps metadata query failed: {e}")
            raise

    def get_division_geometry(self, division_id: str) -> dict:
        """PHASE 2: Fetch geometry for a specific division ID directly from Overture data"""
        try:
            if not self.db:
                raise Exception("Database connection not available")

            # Query for specific geometry directly from Overture parquet files
            geometry_query = """
            SELECT 
                ST_AsGeoJSON(ST_Simplify(ST_GeomFromWKB(geometry), 0.00001)) as geometry_json
            FROM read_parquet('s3://overturemaps-us-west-2/release/2025-06-25.0/theme=divisions/type=division_area/*.parquet')
            WHERE id = ?
            LIMIT 1
            """

            logger.info(f"Fetching simplified geometry for division: {division_id}")

            result = self.db.execute(geometry_query, [division_id]).fetchone()

            if result and result[0]:
                return json.loads(result[0])
            else:
                # Return a default bounding box if geometry not found
                return {
                    "type": "Polygon",
                    "coordinates": [
                        [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]
                    ],
                }

        except Exception as e:
            logger.error(f"Geometry fetch failed for {division_id}: {e}")
            # Return a default bounding box on error
            return {
                "type": "Polygon",
                "coordinates": [
                    [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]
                ],
            }

    def _query_nominatim_data(
        self,
        query: str,
        filters: Dict[str, bool],
        bbox: Optional[Dict[str, float]] = None,
    ) -> List[Dict[str, Any]]:
        """Fallback to OpenStreetMap Nominatim API for geocoding"""
        try:
            logger.info(f"Using Nominatim fallback for query: {query}")

            # Nominatim API endpoint
            base_url = "https://nominatim.openstreetmap.org/search"

            # Prepare search parameters
            params = {
                "q": query,
                "format": "geojson",
                "limit": 10,
                "polygon_geojson": 1,
                "addressdetails": 1,
                "extratags": 1,
            }

            # Add spatial filtering if bbox is provided
            if bbox:
                # Nominatim uses viewbox parameter: left,top,right,bottom (west,north,east,south)
                params["viewbox"] = (
                    f"{bbox['west']},{bbox['north']},{bbox['east']},{bbox['south']}"
                )
                params["bounded"] = 1  # Prefer results within the viewbox
                logger.info(f"Applying Nominatim spatial filter: {bbox}")

            # Add type-specific filters
            if (
                filters.get("city", True)
                and not filters.get("state", True)
                and not filters.get("county", True)
            ):
                params["featuretype"] = "city"
            elif (
                filters.get("state", True)
                and not filters.get("city", True)
                and not filters.get("county", True)
            ):
                params["featuretype"] = "state"

            # Make the API request
            headers = {
                "User-Agent": "DivisionShapeViewer/1.0 (https://github.com/your-repo)"
            }

            response = requests.get(
                base_url, params=params, headers=headers, timeout=10
            )
            response.raise_for_status()

            data = response.json()

            # Convert Nominatim results to our format
            formatted_results = []
            for feature in data.get("features", []):
                try:
                    props = feature.get("properties", {})
                    address = props.get("address", {})

                    # Determine type from OSM data
                    osm_type = props.get("type", "")
                    place_type = props.get("place_type", "")

                    if (
                        "city" in osm_type.lower()
                        or "town" in osm_type.lower()
                        or place_type == "city"
                    ):
                        result_type = "city"
                    elif "state" in osm_type.lower() or "province" in osm_type.lower():
                        result_type = "state"
                    elif "county" in osm_type.lower():
                        result_type = "county"
                    else:
                        result_type = "region"

                    # Apply filters
                    if result_type == "city" and not filters.get("city", True):
                        continue
                    if result_type == "state" and not filters.get("state", True):
                        continue
                    if result_type == "county" and not filters.get("county", True):
                        continue

                    # Build region string
                    region_parts = []
                    if address.get("state"):
                        region_parts.append(address["state"])
                    if address.get("country"):
                        region_parts.append(address["country"])
                    region = ", ".join(region_parts) if region_parts else "Unknown"

                    formatted_result = {
                        "id": f"osm_{props.get('osm_id', len(formatted_results))}",
                        "name": props.get("display_name", "").split(",")[0],
                        "type": result_type,
                        "region": region,
                        "country": address.get("country", "Unknown"),
                        "admin_level": self._get_admin_level_from_type(result_type),
                        "population": None,
                        "geometry": feature.get("geometry"),
                    }
                    formatted_results.append(formatted_result)

                except Exception as feature_error:
                    logger.warning(
                        f"Error processing Nominatim feature: {feature_error}"
                    )
                    continue

            logger.info(f"Nominatim returned {len(formatted_results)} results")
            return formatted_results

        except Exception as e:
            logger.error(f"Nominatim query failed: {e}")
            raise

    def _get_admin_level_from_type(self, type_name: str) -> int:
        """Map our type names to admin levels"""
        mapping = {"city": 8, "county": 6, "state": 4, "country": 2, "region": 5}
        return mapping.get(type_name, 0)

    def _map_overture_type(self, overture_type: str) -> str:
        """Map Overture Maps subtypes to our simplified types"""
        mapping = {
            "locality": "city",
            "administrativeArea": "state",
            "county": "county",
            "region": "region",
            "country": "country",
        }
        return mapping.get(overture_type, overture_type or "unknown")


# Initialize service
overture_service = OvertureDataService()


@app.route("/")
def index():
    """Serve the main HTML file"""
    return send_from_directory(".", "index.html")


@app.route("/<path:filename>")
def serve_static(filename):
    """Serve static files"""
    return send_from_directory(".", filename)


@app.route("/api/search", methods=["POST"])
def search_divisions():
    """Search for divisions based on query and filters"""
    try:
        data = request.get_json()
        query = data.get("query", "")
        filters = data.get("filters", {})
        bbox = data.get("bbox", None)

        if not query:
            return jsonify({"error": "Query parameter is required"}), 400

        results = overture_service.search_divisions(query, filters, bbox)

        return jsonify(results)

    except Exception as e:
        logger.error(f"Search endpoint error: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/geometry/<division_id>", methods=["GET"])
def get_geometry(division_id):
    """Get geometry for a specific division ID"""
    try:
        geometry = overture_service.get_division_geometry(division_id)
        return jsonify({"geometry": geometry})

    except Exception as e:
        logger.error(f"Geometry endpoint error: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/health")
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "overture-maps-viewer"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 4000))
    # Test comment to verify Docker layer caching works
    app.run(debug=False, host="0.0.0.0", port=port)
