class DivisionShapeViewer {
    constructor() {
        this.map = null;
        this.currentLayer = null;
        this.searchResults = [];
        this.selectedArea = null;
        this.init();
    }

    init() {
        this.setupMap();
        this.setupEventListeners();
    }

    setupMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([39.8283, -98.5795], 4); // Center on USA

        // Add OpenStreetMap tiles
        this.osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Add a simple basemap option
        this.cartoDBLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '© OpenStreetMap contributors © CARTO'
        });

        // Layer control
        const baseMaps = {
            "OpenStreetMap": this.osmLayer,
            "CartoDB Light": this.cartoDBLayer,
            "None (White Background)": L.tileLayer('', {
                attribution: ''
            })
        };

        L.control.layers(baseMaps).addTo(this.map);

        // Track if we're showing basemap or not
        this.showingBasemap = true;
    }

    setupEventListeners() {
        const searchBtn = document.getElementById('searchBtn');
        const searchInput = document.getElementById('searchInput');
        const saveBtn = document.getElementById('saveBtn');
        const printBtn = document.getElementById('printBtn');
        const clearBtn = document.getElementById('clearBtn');
        const toggleBackgroundBtn = document.getElementById('toggleBackgroundBtn');

        searchBtn.addEventListener('click', () => this.performSearch());
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.performSearch();
            }
        });

        saveBtn.addEventListener('click', () => this.saveAsImage());
        printBtn.addEventListener('click', () => this.printMap());
        clearBtn.addEventListener('click', () => this.clearMap());
        toggleBackgroundBtn.addEventListener('click', () => this.toggleMapBackground());
    }

    async performSearch() {
        const query = document.getElementById('searchInput').value.trim();
        if (!query) return;

        this.showLoading();
        
        try {
            const filters = {
                city: document.getElementById('cityFilter').checked,
                state: document.getElementById('stateFilter').checked,
                county: document.getElementById('countyFilter').checked
            };
            
            const results = await this.searchOvertureData(query, filters);
            this.displayResults(results);
        } catch (error) {
            this.showError('Error searching for locations: ' + error.message);
        }
    }

    async searchOvertureData(query, filters) {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                filters: filters
            })
        });
        
        if (!response.ok) {
            throw new Error('Search failed');
        }
        
        return await response.json();
    }

    displayResults(results) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsList = document.getElementById('resultsList');
        
        if (results.length === 0) {
            resultsSection.style.display = 'none';
            this.showError('No results found for your search.');
            return;
        }

        resultsList.innerHTML = '';
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            resultItem.innerHTML = `
                <div class="result-name">${result.name}</div>
                <div class="result-details">${result.type} • ${result.region}</div>
            `;
            
            resultItem.addEventListener('click', () => this.selectArea(result));
            resultsList.appendChild(resultItem);
        });

        resultsSection.style.display = 'block';
        this.searchResults = results;
    }

    selectArea(area) {
        // Update UI to show selection
        document.querySelectorAll('.result-item').forEach(item => {
            item.classList.remove('selected');
        });
        event.target.closest('.result-item').classList.add('selected');

        this.selectedArea = area;
        this.displayAreaOnMap(area);
        this.showAreaInfo(area);
        this.showMapControls();
    }

    displayAreaOnMap(area) {
        // Clear existing layer
        if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer);
        }

        // Create GeoJSON layer
        this.currentLayer = L.geoJSON(area.geometry, {
            style: {
                color: '#3498db',
                weight: 3,
                fillColor: '#3498db',
                fillOpacity: 0.1
            }
        }).addTo(this.map);

        // Fit map to bounds
        this.map.fitBounds(this.currentLayer.getBounds());
    }

    showAreaInfo(area) {
        const infoPanel = document.getElementById('infoPanel');
        const areaInfo = document.getElementById('areaInfo');
        
        // Format population if available
        const population = area.population ? area.population.toLocaleString() : 'N/A';
        
        areaInfo.innerHTML = `
            <div class="info-item">
                <span class="info-label">Name:</span>
                <span class="info-value">${area.name}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Type:</span>
                <span class="info-value">${area.type.charAt(0).toUpperCase() + area.type.slice(1)}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Region:</span>
                <span class="info-value">${area.region}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Country:</span>
                <span class="info-value">${area.country || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Population:</span>
                <span class="info-value">${population}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Admin Level:</span>
                <span class="info-value">${area.admin_level || 'N/A'}</span>
            </div>
            <div class="info-item">
                <span class="info-label">ID:</span>
                <span class="info-value">${area.id}</span>
            </div>
        `;
        
        infoPanel.style.display = 'block';
    }

    showMapControls() {
        document.getElementById('toggleBackgroundBtn').style.display = 'inline-block';
        document.getElementById('saveBtn').style.display = 'inline-block';
        document.getElementById('printBtn').style.display = 'inline-block';
        document.getElementById('clearBtn').style.display = 'inline-block';
    }

    async saveAsImage() {
        if (!this.selectedArea) return;

        try {
            const mapElement = document.getElementById('map');
            const canvas = await html2canvas(mapElement, {
                useCORS: true,
                allowTaint: true,
                scale: 2
            });

            // Create download link
            const link = document.createElement('a');
            link.download = `${this.selectedArea.name}_outline.png`;
            link.href = canvas.toDataURL();
            link.click();

            this.showSuccess('Image saved successfully!');
        } catch (error) {
            this.showError('Error saving image: ' + error.message);
        }
    }

    async printMap() {
        if (!this.selectedArea) return;
        
        try {
            // Show loading message
            this.showSuccess('Generating print-ready image...');
            
            // Capture the map as canvas with high quality settings for printing
            const mapElement = document.getElementById('map');
            const canvas = await html2canvas(mapElement, {
                useCORS: true,
                allowTaint: true,
                scale: 3, // Higher scale for better print quality
                backgroundColor: '#ffffff',
                width: mapElement.offsetWidth,
                height: mapElement.offsetHeight,
                logging: false
            });

            // Create a new canvas for the print layout
            const printCanvas = document.createElement('canvas');
            const printCtx = printCanvas.getContext('2d');
            
            // Set canvas size for 8.5x11 inch at 300 DPI (standard print resolution)
            const dpi = 300;
            const pageWidthInches = 8.5;
            const pageHeightInches = 11;
            printCanvas.width = pageWidthInches * dpi;
            printCanvas.height = pageHeightInches * dpi;
            
            // Fill with white background
            printCtx.fillStyle = '#ffffff';
            printCtx.fillRect(0, 0, printCanvas.width, printCanvas.height);
            
            // Add title
            printCtx.fillStyle = '#000000';
            printCtx.font = `${Math.floor(dpi * 0.08)}px Arial, sans-serif`; // Approximately 24pt
            printCtx.textAlign = 'center';
            const titleY = dpi * 0.5; // 0.5 inch from top
            printCtx.fillText(`${this.selectedArea.name} - Boundary Map`, printCanvas.width / 2, titleY);
            
            // Calculate map image dimensions (leave margins for text)
            const marginTop = dpi * 1; // 1 inch from top
            const marginBottom = dpi * 1.5; // 1.5 inches from bottom for info
            const marginSides = dpi * 0.5; // 0.5 inch margins on sides
            
            const availableWidth = printCanvas.width - (marginSides * 2);
            const availableHeight = printCanvas.height - marginTop - marginBottom;
            
            // Scale the map image to fit available space while maintaining aspect ratio
            const mapAspectRatio = canvas.width / canvas.height;
            const availableAspectRatio = availableWidth / availableHeight;
            
            let mapWidth, mapHeight;
            if (mapAspectRatio > availableAspectRatio) {
                // Map is wider - fit to width
                mapWidth = availableWidth;
                mapHeight = mapWidth / mapAspectRatio;
            } else {
                // Map is taller - fit to height
                mapHeight = availableHeight;
                mapWidth = mapHeight * mapAspectRatio;
            }
            
            // Center the map image
            const mapX = (printCanvas.width - mapWidth) / 2;
            const mapY = marginTop + (availableHeight - mapHeight) / 2;
            
            // Draw the map
            printCtx.drawImage(canvas, mapX, mapY, mapWidth, mapHeight);
            
            // Add area information at the bottom
            printCtx.font = `${Math.floor(dpi * 0.04)}px Arial, sans-serif`; // Approximately 12pt
            printCtx.textAlign = 'left';
            const infoStartY = printCanvas.height - marginBottom + (dpi * 0.2);
            const lineHeight = dpi * 0.06; // Line spacing
            
            const infoLines = [
                `Type: ${this.selectedArea.type.charAt(0).toUpperCase() + this.selectedArea.type.slice(1)}`,
                `Region: ${this.selectedArea.region}`,
                `Country: ${this.selectedArea.country || 'N/A'}`,
                `Population: ${this.selectedArea.population ? this.selectedArea.population.toLocaleString() : 'N/A'}`,
                `Generated: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`
            ];
            
            infoLines.forEach((line, index) => {
                printCtx.fillText(line, marginSides, infoStartY + (index * lineHeight));
            });
            
            // Convert to JPG with high quality
            const jpgDataUrl = printCanvas.toDataURL('image/jpeg', 0.95); // 95% quality
            
            // Create download link
            const link = document.createElement('a');
            const fileName = `${this.selectedArea.name.replace(/[^a-z0-9]/gi, '_')}_boundary_print.jpg`;
            link.download = fileName;
            link.href = jpgDataUrl;
            link.click();
            
            this.showSuccess('Print-ready JPG image saved! Ready for printing.');
        } catch (error) {
            this.showError('Error generating print image: ' + error.message);
        }
    }

    clearMap() {
        if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer);
            this.currentLayer = null;
        }
        
        this.selectedArea = null;
        document.getElementById('infoPanel').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('saveBtn').style.display = 'none';
        document.getElementById('printBtn').style.display = 'none';
        document.getElementById('clearBtn').style.display = 'none';
        
        // Reset map view
        this.map.setView([39.8283, -98.5795], 4);
        
        // Clear search input
        document.getElementById('searchInput').value = '';
        
        // Clear any messages
        this.clearMessages();
    }

    showLoading() {
        const resultsList = document.getElementById('resultsList');
        resultsList.innerHTML = '<div class="loading">Searching...</div>';
        document.getElementById('resultsSection').style.display = 'block';
    }

    showError(message) {
        this.clearMessages();
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        container.insertBefore(errorDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    showSuccess(message) {
        this.clearMessages();
        const container = document.querySelector('.container');
        const successDiv = document.createElement('div');
        successDiv.className = 'success';
        successDiv.textContent = message;
        container.insertBefore(successDiv, container.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    clearMessages() {
        const messages = document.querySelectorAll('.error, .success');
        messages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
    }

    toggleMapBackground() {
        const toggleBtn = document.getElementById('toggleBackgroundBtn');
        
        if (this.showingBasemap) {
            // Remove all tile layers to show white background
            this.map.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) {
                    this.map.removeLayer(layer);
                }
            });
            
            // Set map container background to white
            document.getElementById('map').style.backgroundColor = '#ffffff';
            
            toggleBtn.textContent = 'Show Map Background';
            this.showingBasemap = false;
        } else {
            // Add back the default tile layer
            this.osmLayer.addTo(this.map);
            
            // Reset map container background
            document.getElementById('map').style.backgroundColor = '';
            
            toggleBtn.textContent = 'Hide Map Background';
            this.showingBasemap = true;
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DivisionShapeViewer();
});

// Backend Integration Instructions (for production use)
/*
To integrate with actual Overture Maps data, you'll need to:

1. Set up a backend service (Node.js/Python/etc.) that can:
   - Query Overture Maps division data
   - Handle CORS properly
   - Cache results for performance

2. Replace the searchMockData function with actual API calls:

async searchOvertureData(query) {
    const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            query: query,
            filters: {
                city: document.getElementById('cityFilter').checked,
                state: document.getElementById('stateFilter').checked,
                county: document.getElementById('countyFilter').checked
            }
        })
    });
    
    if (!response.ok) {
        throw new Error('Search failed');
    }
    
    return await response.json();
}

3. Example backend endpoint (Node.js/Express):

app.post('/api/search', async (req, res) => {
    try {
        const { query, filters } = req.body;
        
        // Query Overture Maps data using their API or downloaded data
        const results = await queryOvertureData(query, filters);
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

4. For Overture Maps data access:
   - Download data from https://overturemaps.org/
   - Use their Parquet files with DuckDB or similar
   - Or use their API if available
   - Process geometry data to GeoJSON format

5. Security considerations:
   - Implement rate limiting
   - Validate and sanitize input
   - Use HTTPS
   - Implement proper authentication if needed
*/
