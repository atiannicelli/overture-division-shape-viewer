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
            
            // Get current map bounds for spatial filtering
            const bounds = this.map.getBounds();
            const bbox = {
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            };
            
            // Show spatial filtering status
            this.showSearchInfo(`Searching for "${query}" within visible map area...`);
            
            const results = await this.searchOvertureData(query, filters, bbox);
            this.displayResults(results);
        } catch (error) {
            this.showError('Error searching for locations: ' + error.message);
        }
    }

    async searchOvertureData(query, filters, bbox = null) {
        const response = await fetch('/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: query,
                filters: filters,
                bbox: bbox
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
            this.showError('No results found within the visible map area. Try zooming out or panning to a different location.');
            return;
        }

        // Clear any previous messages
        this.clearMessages();

        resultsList.innerHTML = '';
        
        // Add a header showing spatial filtering info
        const headerItem = document.createElement('div');
        headerItem.className = 'results-header';
        headerItem.innerHTML = `
            <div style="padding: 10px; background-color: #f5f5f5; border-radius: 4px; margin-bottom: 10px; font-size: 14px; color: #666;">
                <strong>${results.length}</strong> result${results.length !== 1 ? 's' : ''} found within visible map area
            </div>
        `;
        resultsList.appendChild(headerItem);
        
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
        this.showAreaInfo(area);
        this.showMapControls();
        
        // Fetch and display geometry
        this.fetchAndDisplayGeometry(area);
    }

    async fetchAndDisplayGeometry(area) {
        try {
            // Show loading indicator
            this.showLoadingIndicator('Fetching geometry...');

            // Check if geometry is already available (e.g., from Nominatim fallback)
            if (area.geometry) {
                // Store geometry in selectedArea for image export
                this.selectedArea.geometry = area.geometry;
                this.displayAreaOnMap(area.geometry);
                this.hideLoadingIndicator();
                return;
            }

            // Fetch geometry from our backend API
            const response = await fetch(`/api/geometry/${area.id}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.geometry) {
                // Store geometry in selectedArea for image export
                this.selectedArea.geometry = data.geometry;
                this.displayAreaOnMap(data.geometry);
            } else {
                throw new Error('No geometry data received');
            }
            
        } catch (error) {
            console.error('Error fetching geometry:', error);
            this.showError('Failed to load geometry data. Please try again.');
        } finally {
            this.hideLoadingIndicator();
        }
    }

    displayAreaOnMap(geometry) {
        // Clear existing layer
        if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer);
        }

        if (!geometry) {
            console.warn('No geometry provided to display');
            return;
        }

        // Create GeoJSON layer
        this.currentLayer = L.geoJSON(geometry, {
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
            // Create a canvas for drawing the boundary
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Set canvas size for portrait orientation like standard paper (8.5" x 11" aspect ratio)
            // Using 800x1000 pixels for good quality while keeping file size reasonable
            const mapWidth = 800;
            const mapHeight = 1000; // Portrait aspect ratio (4:5, similar to 8.5:11)
            
            canvas.width = mapWidth * 2; // 2x scale for higher quality
            canvas.height = mapHeight * 2;
            ctx.scale(2, 2);
            
            // Fill with white background
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, mapWidth, mapHeight);
            
            // Draw the boundary outline with optimal bounds
            if (this.currentLayer && this.selectedArea.geometry) {
                // Calculate optimal bounds for the geometry
                const geomBounds = this.calculateGeometryBounds(this.selectedArea.geometry);
                
                // Add padding around the geometry (10% on each side)
                const latPadding = (geomBounds.north - geomBounds.south) * 0.1;
                const lngPadding = (geomBounds.east - geomBounds.west) * 0.1;
                
                const paddedBounds = {
                    north: geomBounds.north + latPadding,
                    south: geomBounds.south - latPadding,
                    east: geomBounds.east + lngPadding,
                    west: geomBounds.west - lngPadding
                };
                
                // Calculate aspect ratios and fit geometry to canvas
                const geomAspectRatio = (paddedBounds.east - paddedBounds.west) / (paddedBounds.north - paddedBounds.south);
                const canvasAspectRatio = mapWidth / mapHeight;
                
                let drawWidth, drawHeight, offsetX, offsetY;
                if (geomAspectRatio > canvasAspectRatio) {
                    // Geometry is wider - fit to width
                    drawWidth = mapWidth * 0.9; // Leave 5% margin on each side
                    drawHeight = drawWidth / geomAspectRatio;
                    offsetX = mapWidth * 0.05;
                    offsetY = (mapHeight - drawHeight) / 2;
                } else {
                    // Geometry is taller - fit to height
                    drawHeight = mapHeight * 0.8; // Leave 10% margin top/bottom for title
                    drawWidth = drawHeight * geomAspectRatio;
                    offsetX = (mapWidth - drawWidth) / 2;
                    offsetY = mapHeight * 0.1;
                }
                
                ctx.strokeStyle = '#000000'; // Black outline
                ctx.lineWidth = 3; // Slightly thicker for better visibility
                // No fillStyle needed since we're only stroking
                
                // Convert geometry coordinates to canvas coordinates with proper scaling
                this.drawGeometryOnPortraitCanvas(ctx, this.selectedArea.geometry, paddedBounds, offsetX, offsetY, drawWidth, drawHeight);
            }
            
            // Add title
            ctx.fillStyle = '#000000';
            ctx.font = '20px Arial, sans-serif'; // Slightly larger for portrait format
            ctx.textAlign = 'center';
            ctx.fillText(`${this.selectedArea.name} - Boundary Outline`, mapWidth / 2, 40);
            
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
    
    drawGeometryOnCanvas(ctx, geometry, bounds, canvasWidth, canvasHeight) {
        const latRange = bounds.getNorth() - bounds.getSouth();
        const lngRange = bounds.getEast() - bounds.getWest();
        
        // Function to convert lat/lng to canvas coordinates
        const coordToCanvas = (lat, lng) => {
            const x = ((lng - bounds.getWest()) / lngRange) * canvasWidth;
            const y = ((bounds.getNorth() - lat) / latRange) * canvasHeight;
            return { x, y };
        };
        
        // Handle different geometry types
        if (geometry.type === 'Polygon') {
            this.drawPolygonOnCanvas(ctx, geometry.coordinates, coordToCanvas);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                this.drawPolygonOnCanvas(ctx, polygon, coordToCanvas);
            });
        }
    }
    
    drawPolygonOnCanvas(ctx, coordinates, coordToCanvas) {
        coordinates.forEach((ring, ringIndex) => {
            ctx.beginPath();
            
            ring.forEach((coord, index) => {
                const canvasCoord = coordToCanvas(coord[1], coord[0]); // Note: coord is [lng, lat]
                
                if (index === 0) {
                    ctx.moveTo(canvasCoord.x, canvasCoord.y);
                } else {
                    ctx.lineTo(canvasCoord.x, canvasCoord.y);
                }
            });
            
            ctx.closePath();
            
            if (ringIndex === 0) {
                // Outer ring - stroke only (no fill for outline-only appearance)
                ctx.stroke();
            } else {
                // Inner ring (hole) - stroke only
                ctx.stroke();
            }
        });
    }

    drawGeometryOnPortraitCanvas(ctx, geometry, bounds, offsetX, offsetY, drawWidth, drawHeight) {
        const latRange = bounds.north - bounds.south;
        const lngRange = bounds.east - bounds.west;
        
        // Function to convert lat/lng to canvas coordinates with proper scaling
        const coordToCanvas = (lat, lng) => {
            const x = offsetX + ((lng - bounds.west) / lngRange) * drawWidth;
            const y = offsetY + ((bounds.north - lat) / latRange) * drawHeight;
            return { x, y };
        };
        
        // Handle different geometry types
        if (geometry.type === 'Polygon') {
            this.drawPolygonOnCanvas(ctx, geometry.coordinates, coordToCanvas);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                this.drawPolygonOnCanvas(ctx, polygon, coordToCanvas);
            });
        }
    }

    async printMap() {
        if (!this.selectedArea) return;
        
        try {
            // Show loading message
            this.showSuccess('Generating print-ready image...');
            
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
            
            // Calculate map area dimensions (leave margins for text)
            const marginTop = dpi * 1; // 1 inch from top
            const marginBottom = dpi * 1.5; // 1.5 inches from bottom for info
            const marginSides = dpi * 0.5; // 0.5 inch margins on sides
            
            const mapAreaWidth = printCanvas.width - (marginSides * 2);
            const mapAreaHeight = printCanvas.height - marginTop - marginBottom;
            
            // Get current map bounds for the geometry
            const bounds = this.map.getBounds();
            
            // Calculate optimal bounds for the selected area geometry
            if (this.selectedArea.geometry) {
                const geomBounds = this.calculateGeometryBounds(this.selectedArea.geometry);
                
                // Add padding around the geometry (10% on each side)
                const latPadding = (geomBounds.north - geomBounds.south) * 0.1;
                const lngPadding = (geomBounds.east - geomBounds.west) * 0.1;
                
                const paddedBounds = {
                    north: geomBounds.north + latPadding,
                    south: geomBounds.south - latPadding,
                    east: geomBounds.east + lngPadding,
                    west: geomBounds.west - lngPadding
                };
                
                // Calculate aspect ratios
                const geomAspectRatio = (paddedBounds.east - paddedBounds.west) / (paddedBounds.north - paddedBounds.south);
                const mapAreaAspectRatio = mapAreaWidth / mapAreaHeight;
                
                let mapWidth, mapHeight;
                if (geomAspectRatio > mapAreaAspectRatio) {
                    // Geometry is wider - fit to width
                    mapWidth = mapAreaWidth;
                    mapHeight = mapWidth / geomAspectRatio;
                } else {
                    // Geometry is taller - fit to height
                    mapHeight = mapAreaHeight;
                    mapWidth = mapHeight * geomAspectRatio;
                }
                
                // Center the map area
                const mapX = (printCanvas.width - mapWidth) / 2;
                const mapY = marginTop + (mapAreaHeight - mapHeight) / 2;
                
                // Draw the boundary outline
                printCtx.strokeStyle = '#000000'; // Black outline
                printCtx.lineWidth = dpi * 0.01; // Slightly thicker proportional line width for print
                // No fillStyle needed since we're only stroking
                
                // Convert geometry coordinates to print canvas coordinates
                this.drawGeometryOnPrintCanvas(printCtx, this.selectedArea.geometry, paddedBounds, mapX, mapY, mapWidth, mapHeight);
            }
            
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
    
    calculateGeometryBounds(geometry) {
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        
        const processCoordinates = (coords) => {
            coords.forEach(coord => {
                if (Array.isArray(coord[0])) {
                    processCoordinates(coord);
                } else {
                    const lng = coord[0];
                    const lat = coord[1];
                    minLat = Math.min(minLat, lat);
                    maxLat = Math.max(maxLat, lat);
                    minLng = Math.min(minLng, lng);
                    maxLng = Math.max(maxLng, lng);
                }
            });
        };
        
        if (geometry.type === 'Polygon') {
            processCoordinates(geometry.coordinates);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                processCoordinates(polygon);
            });
        }
        
        return {
            north: maxLat,
            south: minLat,
            east: maxLng,
            west: minLng
        };
    }
    
    drawGeometryOnPrintCanvas(ctx, geometry, bounds, offsetX, offsetY, canvasWidth, canvasHeight) {
        const latRange = bounds.north - bounds.south;
        const lngRange = bounds.east - bounds.west;
        
        // Function to convert lat/lng to canvas coordinates
        const coordToCanvas = (lat, lng) => {
            const x = offsetX + ((lng - bounds.west) / lngRange) * canvasWidth;
            const y = offsetY + ((bounds.north - lat) / latRange) * canvasHeight;
            return { x, y };
        };
        
        // Handle different geometry types
        if (geometry.type === 'Polygon') {
            this.drawPolygonOnCanvas(ctx, geometry.coordinates, coordToCanvas);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(polygon => {
                this.drawPolygonOnCanvas(ctx, polygon, coordToCanvas);
            });
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

    showSearchInfo(message) {
        this.clearMessages();
        const container = document.querySelector('.container');
        const infoDiv = document.createElement('div');
        infoDiv.className = 'search-info';
        infoDiv.textContent = message;
        infoDiv.style.cssText = `
            background-color: #e3f2fd;
            color: #1976d2;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            border-left: 4px solid #1976d2;
        `;
        container.insertBefore(infoDiv, container.firstChild);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (infoDiv.parentNode) {
                infoDiv.parentNode.removeChild(infoDiv);
            }
        }, 3000);
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
        const messages = document.querySelectorAll('.error, .success, .search-info');
        messages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });
    }

    showLoadingIndicator(message = 'Loading...') {
        this.hideLoadingIndicator(); // Clear any existing indicator
        
        const container = document.querySelector('.container');
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loadingIndicator';
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        `;
        container.appendChild(loadingDiv);
    }

    hideLoadingIndicator() {
        const indicator = document.getElementById('loadingIndicator');
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

    toggleMapBackground() {
        const toggleBtn = document.getElementById('toggleBackgroundBtn');
        
        if (this.showingBasemap) {
            // Store current map state
            const currentCenter = this.map.getCenter();
            const currentZoom = this.map.getZoom();
            
            // Remove all tile layers to show white background
            this.map.eachLayer((layer) => {
                if (layer instanceof L.TileLayer) {
                    this.map.removeLayer(layer);
                }
            });
            
            // Set map container background to white
            document.getElementById('map').style.backgroundColor = '#ffffff';
            
            // Ensure map maintains its coordinate system by triggering a refresh
            setTimeout(() => {
                this.map.setView(currentCenter, currentZoom);
                this.map.invalidateSize();
            }, 100);
            
            toggleBtn.textContent = 'Show Map Background';
            this.showingBasemap = false;
        } else {
            // Store current map state
            const currentCenter = this.map.getCenter();
            const currentZoom = this.map.getZoom();
            
            // Add back the default tile layer
            this.osmLayer.addTo(this.map);
            
            // Reset map container background
            document.getElementById('map').style.backgroundColor = '';
            
            // Ensure coordinate system stability
            setTimeout(() => {
                this.map.setView(currentCenter, currentZoom);
                this.map.invalidateSize();
            }, 100);
            
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
