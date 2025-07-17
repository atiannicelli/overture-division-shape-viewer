# Division Shape Viewer - Overture Maps

A web application for searching and visualizing administrative divisions (cities, states, counties) using Overture Maps data.

## 🌐 Live Demo

[View Live Application](https://overture-division-shape-viewer.fly.dev/) - **Now Live on Fly.io!**

## Features

- **Search Functionality**: Search for cities, states, and counties by name
- **Interactive Map**: View selected areas on an interactive map with outlined boundaries
- **Export Options**: Save area outlines as images or print them
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Results**: Get instant search results with detailed information

## 🚀 Deployment

This application is automatically deployed from GitHub using Fly.io.

### Deploy Your Own Copy

1. **Fork this repository** on GitHub
2. **Sign up for Fly.io** at [fly.io](https://fly.io)
3. **Connect your GitHub account** to Fly.io
4. **Create a new app** in Fly.io dashboard
5. **Set up GitHub Actions deployment**:
   - Get your Fly API token from dashboard
   - Add `FLY_API_TOKEN` to GitHub repository secrets
   - Push to main branch triggers automatic deployment

## Setup Instructions

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Installation

1. **Clone or download the project files**

2. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   python backend.py
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

## Usage

1. **Search**: Enter a city, state, or area name in the search box
2. **Filter**: Use the checkboxes to filter results by type (cities, states, counties)
3. **Select**: Click on a search result to display it on the map
4. **Export**: Use the "Save as Image" or "Print" buttons to export the outline
5. **Clear**: Use the "Clear" button to reset the map and start over

## Integrating with Real Overture Maps Data

The current implementation uses mock data for demonstration. To integrate with actual Overture Maps data:

### Option 1: Using Overture Maps Parquet Files

1. **Download Overture Maps data**:
   ```bash
   # Download division data (example)
   wget https://overturemaps.org/data/divisions/latest/divisions.parquet
   ```

2. **Update the backend** to query real data:
   ```python
   def search_divisions(self, query: str, filters: Dict[str, bool]) -> List[Dict[str, Any]]:
       # Query actual Overture Maps data
       result = self.db.execute(f"""
           SELECT 
               id,
               names.primary as name,
               subtype as type,
               country,
               admin_level,
               ST_AsText(geometry) as geometry_wkt
           FROM read_parquet('divisions.parquet')
           WHERE names.primary ILIKE '%{query}%'
           AND subtype IN ('city', 'state', 'county')
           LIMIT 20
       """).fetchall()
       
       return self._format_results(result)
   ```

### Option 2: Using DuckDB with Remote Data

```python
# In the backend.py file, update the setup_database method:
def setup_database(self):
    self.db = duckdb.connect(':memory:')
    self.db.execute("INSTALL spatial;")
    self.db.execute("LOAD spatial;")
    self.db.execute("INSTALL httpfs;")
    self.db.execute("LOAD httpfs;")
    
    # Load remote Overture Maps data
    overture_url = "https://overturemaps.org/data/divisions/latest/"
    self.db.execute(f"CREATE VIEW divisions AS SELECT * FROM read_parquet('{overture_url}*.parquet')")
```

## File Structure

```
division_shapes/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # Frontend JavaScript
├── backend.py          # Python Flask backend
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## API Endpoints

- `GET /` - Serve the main application
- `POST /api/search` - Search for divisions
- `GET /api/health` - Health check

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mapping**: Leaflet.js
- **Backend**: Python Flask
- **Database**: DuckDB
- **Data Source**: Overture Maps (simulated with mock data)

## Browser Support

- Chrome/Chromium 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues and questions, please create an issue in the project repository.

## Acknowledgments

- [Overture Maps Foundation](https://overturemaps.org/) for providing the data
- [Leaflet](https://leafletjs.com/) for the mapping library
- [DuckDB](https://duckdb.org/) for spatial data processing
