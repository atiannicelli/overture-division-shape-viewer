from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
import requests
import urllib.parse
from typing import List, Dict, Any
import logging

app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class OvertureDataService:
    def __init__(self):
        # Removed DuckDB dependency for lighter deployment
        self.setup_service()
        self.db = None
        self.setup_database()

    def setup_database(self):
        """Initialize DuckDB connection and load Overture Maps data"""
        try:
            self.db = duckdb.connect(":memory:")

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

            logger.info("Database setup completed successfully")
        except Exception as e:
            logger.error(f"Database setup failed: {e}")
            # Don't raise the exception, just log it and continue with mock data
            self.db = None

    def search_divisions(
        self, query: str, filters: Dict[str, bool]
    ) -> List[Dict[str, Any]]:
        """Search for divisions in Overture Maps data"""
        try:
            # Try to query actual Overture Maps data first
            try:
                results = self._query_overture_data(query, filters)
                if results:
                    logger.info(f"Found {len(results)} results from Overture Maps data")
                    return results
            except Exception as overture_error:
                logger.warning(
                    f"Overture Maps query failed, falling back to mock data: {overture_error}"
                )

            # Fallback to mock data if Overture query fails
            results = self._get_mock_data(query, filters)
            logger.info(f"Using mock data, found {len(results)} results")
            return results

        except Exception as e:
            logger.error(f"Search failed: {e}")
            raise

    def _query_overture_data(
        self, query: str, filters: Dict[str, bool]
    ) -> List[Dict[str, Any]]:
        """Query actual Overture Maps data from S3"""
        try:
            # Check if database is available
            if not self.db:
                raise Exception("Database connection not available")

            # Try a simpler approach first - use the public Overture Maps data
            # The divisions data is available in a different structure
            base_url = "https://overturemaps-us-west-2.s3.amazonaws.com/release/2024-07-22.0/theme=divisions"

            # First, let's try to access a sample file to test connectivity
            test_query = """
            SELECT COUNT(*) as count
            FROM read_parquet('https://overturemaps-us-west-2.s3.amazonaws.com/release/2024-07-22.0/theme=divisions/type=division_area/part-00000-*.parquet')
            LIMIT 1
            """

            try:
                test_result = self.db.execute(test_query).fetchone()
                logger.info(
                    f"Overture data connectivity test successful: {test_result}"
                )
            except Exception as test_error:
                logger.warning(f"Direct S3 access failed: {test_error}")
                # Try alternative approach with OpenStreetMap Nominatim API
                return self._query_nominatim_data(query, filters)

            # Build the main SQL query for Overture Maps data
            sql_query = f"""
            SELECT 
                id,
                names.primary as name,
                subtype,
                names.common,
                country,
                admin_level,
                ST_AsGeoJSON(geometry) as geometry_json
            FROM read_parquet('https://overturemaps-us-west-2.s3.amazonaws.com/release/2024-07-22.0/theme=divisions/type=division_area/*.parquet')
            WHERE names.primary IS NOT NULL
            AND (names.primary ILIKE '%{query}%' OR names.common ILIKE '%{query}%')
            """

            # Add type filters based on admin_level instead of subtype
            admin_level_conditions = []
            if filters.get("city", True):
                admin_level_conditions.append(
                    "admin_level >= 8"
                )  # Cities and localities
            if filters.get("state", True):
                admin_level_conditions.append("admin_level = 4")  # States/Provinces
            if filters.get("county", True):
                admin_level_conditions.append("admin_level = 6")  # Counties

            if admin_level_conditions:
                sql_query += f" AND ({' OR '.join(admin_level_conditions)})"

            sql_query += " LIMIT 20"

            logger.info(f"Executing Overture query for '{query}'")

            # Execute the query
            result = self.db.execute(sql_query).fetchall()

            # Convert results to the expected format
            formatted_results = []
            for row in result:
                try:
                    geometry_json = json.loads(row[6]) if row[6] else None

                    # Determine type based on admin_level
                    admin_level = row[5] or 0
                    if admin_level >= 8:
                        type_name = "city"
                    elif admin_level == 6:
                        type_name = "county"
                    elif admin_level == 4:
                        type_name = "state"
                    else:
                        type_name = "region"

                    formatted_result = {
                        "id": row[0] or f"overture_{len(formatted_results)}",
                        "name": row[1] or row[3] or "Unknown",
                        "type": type_name,
                        "region": f"{row[4] or 'Unknown'}",
                        "country": row[4] or "Unknown",
                        "admin_level": admin_level,
                        "population": None,  # Population not available in divisions data
                        "geometry": geometry_json,
                    }
                    formatted_results.append(formatted_result)
                except Exception as row_error:
                    logger.warning(f"Error processing row: {row_error}")
                    continue

            logger.info(
                f"Successfully processed {len(formatted_results)} results from Overture Maps"
            )
            return formatted_results

        except Exception as e:
            logger.error(f"Overture Maps query failed: {e}")
            raise

    def _query_nominatim_data(
        self, query: str, filters: Dict[str, bool]
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

    def _get_mock_data(
        self, query: str, filters: Dict[str, bool]
    ) -> List[Dict[str, Any]]:
        """Mock data for demonstration purposes"""
        mock_data = [
            {
                "id": "division_1",
                "name": "San Francisco",
                "type": "city",
                "region": "California, USA",
                "country": "US",
                "admin_level": 8,
                "population": 874784,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-122.514926, 37.708949],
                            [-122.357178, 37.708949],
                            [-122.357178, 37.832049],
                            [-122.514926, 37.832049],
                            [-122.514926, 37.708949],
                        ]
                    ],
                },
            },
            {
                "id": "division_2",
                "name": "Los Angeles",
                "type": "city",
                "region": "California, USA",
                "country": "US",
                "admin_level": 8,
                "population": 3971883,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-118.668404, 33.703652],
                            [-118.155289, 33.703652],
                            [-118.155289, 34.337306],
                            [-118.668404, 34.337306],
                            [-118.668404, 33.703652],
                        ]
                    ],
                },
            },
            {
                "id": "division_3",
                "name": "California",
                "type": "state",
                "region": "USA",
                "country": "US",
                "admin_level": 4,
                "population": 39538223,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-124.409591, 32.534156],
                            [-114.131211, 32.534156],
                            [-114.131211, 42.009518],
                            [-124.409591, 42.009518],
                            [-124.409591, 32.534156],
                        ]
                    ],
                },
            },
            {
                "id": "division_4",
                "name": "Orange County",
                "type": "county",
                "region": "California, USA",
                "country": "US",
                "admin_level": 6,
                "population": 3186989,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-118.006071, 33.347929],
                            [-117.627805, 33.347929],
                            [-117.627805, 33.774809],
                            [-118.006071, 33.774809],
                            [-118.006071, 33.347929],
                        ]
                    ],
                },
            },
            {
                "id": "division_5",
                "name": "New York",
                "type": "city",
                "region": "New York, USA",
                "country": "US",
                "admin_level": 8,
                "population": 8336817,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-74.259090, 40.477399],
                            [-73.700272, 40.477399],
                            [-73.700272, 40.917577],
                            [-74.259090, 40.917577],
                            [-74.259090, 40.477399],
                        ]
                    ],
                },
            },
            {
                "id": "division_6",
                "name": "New York",
                "type": "state",
                "region": "USA",
                "country": "US",
                "admin_level": 4,
                "population": 19336776,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [-79.762152, 40.496103],
                            [-71.856214, 40.496103],
                            [-71.856214, 45.015865],
                            [-79.762152, 45.015865],
                            [-79.762152, 40.496103],
                        ]
                    ],
                },
            },
        ]

        # Filter based on query
        filtered_results = []
        query_lower = query.lower()

        for item in mock_data:
            if (
                query_lower in item["name"].lower()
                or query_lower in item["region"].lower()
            ):
                # Apply type filters
                if item["type"] == "city" and filters.get("city", True):
                    filtered_results.append(item)
                elif item["type"] == "state" and filters.get("state", True):
                    filtered_results.append(item)
                elif item["type"] == "county" and filters.get("county", True):
                    filtered_results.append(item)

        return filtered_results[:10]  # Limit results


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

        if not query:
            return jsonify({"error": "Query parameter is required"}), 400

        results = overture_service.search_divisions(query, filters)

        return jsonify(results)

    except Exception as e:
        logger.error(f"Search endpoint error: {e}")
        return jsonify({"error": "Internal server error"}), 500


@app.route("/api/health")
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "overture-maps-viewer"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
