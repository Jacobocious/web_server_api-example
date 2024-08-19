// by Jacob Jackson
// for CSCI4131 homework 3
// javascript file

//function to handle schedule page functionality
function setupSchedulePage() {
    var scheduleTable = document.getElementById('schedule-table');
    if (!scheduleTable) return;

    var rows = scheduleTable.querySelectorAll('tr');
    rows.forEach(function(row) {
        var cell = row.querySelector('td:nth-child(4)');
        if (cell) {
            var imgSrc = cell.getAttribute('data-img-src');

            row.addEventListener('mouseover', function() {
                document.querySelectorAll('.thumbnail').forEach(function(thumbnail) {
                    thumbnail.remove();
                });

                var thumbnail = document.createElement('img');
                thumbnail.src = imgSrc;
                thumbnail.classList.add('thumbnail');
                thumbnail.style.width = '50px';
                thumbnail.style.height = '33px';
                thumbnail.style.marginTop = '3px';
                cell.appendChild(thumbnail);

                var fullImage = document.getElementById('image-container').querySelector('img');
                fullImage.src = imgSrc;
            });

            row.addEventListener('mouseout', function() {
                var thumbnail = cell.querySelector('.thumbnail');
                if (thumbnail) {
                    thumbnail.remove();
                }
            });
        }
    });
}

//function to handle form validation for event scheduling
function setupFormValidation() {
    var form = document.querySelector('form#eventForm');
    if (!form) return;

    form.addEventListener('submit', function(event) {
        var startTime = document.getElementById('startTime').value;
        var endTime = document.getElementById('endTime').value;
        var start = new Date(`1970-01-01T${startTime}:00Z`);
        var end = new Date(`1970-01-01T${endTime}:00Z`);

        if (start >= end) {
            alert('Start time must be before stop time.');
            event.preventDefault();
        }
    });
}

//function for the clock widget functionality
function startClock() {
    var clockContainer = document.getElementById('clock-widget');
    if (!clockContainer) return;

    function updateClock() {
        const now = new Date();
        let hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        let ampm = hours >= 12 ? 'PM' : 'AM';

        hours = hours % 12;
        hours = hours ? hours : 12;

        const hourDis = document.getElementById('c-hour');
        const minuteDis = document.getElementById('c-minute');
        const secondDis = document.getElementById('c-second');
        const ampmDis = document.getElementById('c-ampm');

        hourDis.textContent = hours.toString();
        minuteDis.textContent = minutes;
        secondDis.textContent = seconds;
        ampmDis.textContent = ampm;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// function for toggling 'other' box in schedule map
function toggleOther(selectElement) {
    var otherInput = document.getElementById('other-search');
    if (selectElement.value === 'other') {
        otherInput.style.display = 'block';
    } else {
        otherInput.style.display = 'none';
    }
}

//*************************SCHEDULE MAP***********************************
// credit to the following sources for the big syntax help:
// https://developers.google.com/maps/documentation/javascript/places
// https://developers.google.com/maps/documentation/javascript/directions
// https://developers.google.com/maps/documentation/javascript/geolocation
function setupScheduleMap() {
    var scheduleMap = document.getElementById('sched-map');
    if (!scheduleMap) return;
	
	// variables for various use
	var map, directionsService, directionsRenderer, userLocation;
	var placesService;
	var markersArray = [];
    
	// make initialize map function
    function initMap() {
        userLocation = {lat: 44.97727, lng: -93.23540000000003};
        map = new google.maps.Map(document.getElementById('sched-map'), {
            zoom: 14,
            center: userLocation
        });
		
        var geocoder = new google.maps.Geocoder();
		directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer();
        directionsRenderer.setMap(map);

        // use geolocation to get current position
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition( (position) => {
                userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
				// center on current location (note, user must accept to use location)
                map.setCenter(userLocation);
            }, function(error) {
				handleLocationError(true, map.getCenter());
			}, { enableHighAccuracy: true });
        } else {
            alert('Geocode was not successful due to the following: ' + status);
        }
		
		// call function for places service and extract events from table
		placesService = new google.maps.places.PlacesService(map);
        getTableEvents(geocoder, map);
    } 
    

	// function to get events from table and mark them on map
    function getTableEvents(geocoder, map) {
        const rows = document.querySelectorAll("#schedule-table tbody tr");
        rows.forEach(row => {
            const cells = row.cells;
			// i also trim in case of white space in future
			const eventDay = cells[0].textContent.trim();
            const eventName = cells[1].textContent.trim();
            const eventTime = cells[2].textContent.trim();
            const address = cells[3].textContent.trim();
			
			// if address has virtual, do not attempt to set it
            if (address.toLowerCase().includes("virtual")) return;

            geocodeAddress(geocoder, map, address, eventName, eventTime, eventDay);
        });
    }
	
	// function to geocode address for the sched-map
    function geocodeAddress(geocoder, map, address, eventName, eventTime, eventDay) {
        geocoder.geocode({'address': address}, function(results, status) {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                const marker = new google.maps.Marker({
                    map: map,
                    position: location,
                    title: eventName,
					// set custom icon
					icon: {
						url: "/static/img/Goldy.png",
						scaledSize: new google.maps.Size(35, 35),
					}
                });
				// make new infowindow based on name, day+time, and address
                const infoContent = `<div><strong>${eventName}</strong><br>${eventDay}, ${eventTime}<br>${address}</div>`;
                const infowindow = new google.maps.InfoWindow({
                    content: infoContent
                });
				
				//open window on click
                marker.addListener('click', function() {
                    infowindow.open(map, marker);
                });		
            } else {
                alert('Geocode was not successful for the following reason: ' + status);
            }
        });
    }
	
	// function to display the route entered in
	function displayNewRoute(destination) {
        if (!userLocation) {
            alert('User location is not available.');
            return;
        }
		
		// get travel mode from radio checked selection
        var currentMode = document.querySelector('input[name="travel-mode"]:checked').value; 
		// use directions service to set route
        directionsService.route({
            origin: userLocation,
            destination: destination,
            travelMode: google.maps.TravelMode[currentMode]
			// check status for success and display eror alert otherwise
        }, function(response, status) { 
            if (status == 'OK') {
                directionsRenderer.setDirections(response);
                directionsRenderer.setPanel(document.getElementById('directions-panel'));
            } else {
                window.alert('Directions request failed due to ' + status);
            }
        });
    }
	
	// event listener to reformat map with the directions panel
	document.getElementById('get-directions').addEventListener('click', function() {
        var destination = document.getElementById('destination').value; 
		
		// ****css settings***
		var directionsPanel = document.getElementById('directions-panel');
		var mapContainer = document.getElementById('map-container');
		var menuContainer = document.getElementById('menu-container');

		directionsPanel.style.height = '60%';
		mapContainer.style.height = '60%';
		menuContainer.style.height = '60%';
		mapContainer.style.gridColumn = '2';
		// ********************
		
        displayNewRoute(destination);
    });
	
	// function to search nearby places based on radius in meters
	function searchNearbyPlaces() {
        var placeType = document.getElementById('place-type').value;
        var radius = document.getElementById('search-radius').value;
        var keyword = document.getElementById('other-search').style.display !== 'none' ? document.getElementById('other-search').value : null;
		
		// check for 0 or negative radius
		if (radius <= 0) {
			alert('Please enter a radius greater than 0.');
			// clear radius and refocus to try again
			document.getElementById('search-radius').value = '';
			document.getElementById('search-radius').focus();
			return false; 
		}
		
		// set request values
        var request = {
            location: userLocation,
            radius: radius,
            type: [placeType]
        };

        // set keyword to whatever the 'other' search is and set request
        if (placeType === 'other' && keyword) {
            request.keyword = keyword;
        } else {
			document.getElementById('other-search').value='';
		}

        placesService.nearbySearch(request, function(results, status) {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
				// clear marker before making new ones
                clearMarkers();
				
				// make new marker for each results places
                results.forEach(function(place) {
                    createNewMarker(place);
                });
            } else {
				// send alert and clear radius since produced no result
                window.alert('Places request failed due to ' + status);
				document.getElementById('search-radius').value = '';
				document.getElementById('search-radius').focus();
            }
        });
    }
	
	// function to create marker
    function createNewMarker(place) {
        var marker = new google.maps.Marker({
            map: map,
            position: place.geometry.location,
            title: place.name
        });
		
		markersArray.push(marker);

        google.maps.event.addListener(marker, 'click', function() {
			// first use address, then vicin, then display no available
			var address = place.address || place.vicinity || 'No address available';
			var contentString = '<div><strong>' + place.name + '</strong><br>' + address + '</div>';
			var infowindow = new google.maps.InfoWindow({
				content: contentString
			});
			infowindow.open(map, marker);
		});
    }

    function clearMarkers() {
		// remove all markres from array
		for (var i = 0; i < markersArray.length; i++) {
			markersArray[i].setMap(null);
		}
		// reset array
		markersArray = [];
	}

    // evnent listener for search and clear buttons
    document.getElementById('search-places').addEventListener('click', searchNearbyPlaces);
	document.getElementById('clear-places').addEventListener('click', clearMarkers);
	
	initMap();
}

// **********************************FORM MAP************************************
// credit to the following for syntax help:
// https://developers.google.com/maps/documentation/javascript/place-autocomplete
function setupFormMap() {
    var formMap = document.getElementById('form-map');
    if (!formMap) return;

    // make new google map with same settings as usual
    var map = new google.maps.Map(formMap, {
        zoom: 14,
        center: { lat: 44.97727, lng: -93.23540000000003 },
    });

    // set up autocomplete functionality
    var locationInput = document.getElementById('location');
    var autocomplete = new google.maps.places.Autocomplete(locationInput);
    autocomplete.bindTo('bounds', map); // make sure its within viewport
	
	// for form autocomplete
    function updateMyPlace() {
        var place = autocomplete.getPlace();
        if (!place.geometry) {
            console.error("No geo");
            return;
        }

        // change to map location
        if (place.geometry.viewport) {
            map.fitBounds(place.geometry.viewport);
        } else { // just center on location
            map.setCenter(place.geometry.location);
            map.setZoom(17);
        }
    }
	
	autocomplete.addListener('place_changed', updateMyPlace);

    // add listener to get address on click
    map.addListener('click', function(mapsMouseEvent) {
        // Get the lat/lng from the clicked location
        var clickedLocation = mapsMouseEvent.latLng;

        // using geocoder to get location address (make new map)
        var geocoder = new google.maps.Geocoder();
		// function for clicking on location
        geocoder.geocode({ 'location': clickedLocation }, function(results, status) {
            if (status === google.maps.GeocoderStatus.OK && results[0]) {
                // get first result
                var nearest = results[0].formatted_address;

                // set autocomplete to nearest
                locationInput.value = nearest;
				
				// call myplace
				updateMyPlace();

            } else {
                console.error('Geocoder failed due to: ' + status);
            }
        });
    });
}

//****************************STOCK FUNCTIONALITY***********************************
// credit to syntax help from https://jsfiddle.net/wagenaartje/2pph8rax/4/ (example)
function setupStocks() {
    if (!document.getElementById('stock-header')) return;
	
	var stocks = new Stocks('P72RFL30H4Z62AFF');
	
	// setup event listener for button click
	document.getElementById('stock-button').addEventListener('click', function() {
		var symbol = document.getElementById('stock-symbol').value; // retrieve symb
		if (symbol) {
			requestStockData(symbol);
		} else {
			alert('Please enter a stock symbol.');
		}
	});
	
	// get the stock data using inputted symbol
	async function requestStockData(symbol) {		
		var result = await stocks.timeSeries({
			symbol: symbol,
			interval: '1min',
			amount: 10 // set this to whatever you desire
		});
		
		// set the output to the text area
		document.getElementById('api-response').value = JSON.stringify(result, null, 2);		
	}
}
	
	
//event lisetner for DOMContentLoaded to call the defined functions
document.addEventListener('DOMContentLoaded', function() {
    setupSchedulePage();
    setupFormValidation();
    startClock();
	setupStocks();
});
