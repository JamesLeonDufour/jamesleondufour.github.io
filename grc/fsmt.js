
jQuery(document).ready(function() {
	

	
	d3.csv("fmst.csv", function(data) {
		
		d3.csv("fields.csv", function(fields) {
			
			//map
			var map = L.map('map');
			map.setView([0, 0], 1);
			//scalebar
			L.control.scale().addTo(map);
			//basemaps
			var mapnik = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 18});
			var osm_HOT = L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Tiles courtesy of <a href="http://hot.openstreetmap.org/" target="_blank">Humanitarian OpenStreetMap Team</a>'});
			var esri_satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; <a href="http://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community', maxZoom: 18});
			var esri_lightGrey = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: '&copy; <a href="http://www.esri.com/">Esri</a>,  HERE, DeLorme, MapmyIndia, © OpenStreetMap contributors, and the GIS user community ',maxZoom: 18});
			var esri_street = L.tileLayer('https://server.arcgisonline.com/arcgis/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {attribution: '&copy; <a href="http://www.esri.com/">Esri</a>', maxZoom: 18});
			osm_HOT.addTo(map);

			// adding markers from CSV to map + to search fonction
			var csv_markers = new L.featureGroup().addTo(map);
			var marker_list = [];
			for (var i in data){
				if (data[i][config.lat] && data[i][config.lon]){
					var icon = L.icon({
						iconUrl: 'img/markers_icon/'+data[i][config.type]+'.svg',
						iconSize:     [20, 20], // size of the icon 
					});
					var marker = new L.marker([data[i][config.lat], data[i][config.lon]], {icon: icon, title:data[i]}).bindPopup(data[i][config.name]);
					csv_markers.addLayer(marker)
					marker_list.push({'name':data[i][config.name], 'coordo': [data[i][config.lat], data[i][config.lon]], "properties":data[i]})
					
				}
			}
			map.fitBounds(csv_markers.getBounds());
			$('.typeahead').typeahead({
				source:marker_list,
				afterSelect: function(item) {
					info(item.properties);
					map.setView(item.coordo);
					map.setZoom(12);
					for (var i in csv_markers._layers){
						if (item.name == csv_markers._layers[i].options.title[config.name]){	
							csv_markers._layers[i].openPopup()
						}
					}
				},
			})
			csv_markers.on('click', function (a) {
				var a = a.layer.options.title
				info(a)
			});
			
			//layer switcher
			var baseMaps = {
				"OSM": mapnik,
				"OSM_HOT": osm_HOT,
				"Esri Satellite": esri_satellite,
				"Esri Light Grey": esri_lightGrey,
				"Esri Streets": esri_street,
			};
			var overlayMaps = {
				"Sites": csv_markers
			};
			L.control.layers(baseMaps, overlayMaps).addTo(map);
			
			$('.typeahead').show();
			$('#left_of_map').show();
			
			var c = config.categories
			
			
//********  when clicking on a marker  ********//
			
			function info(h){

				//emptying divs
				left_of_map.innerHTML = "";
				below_map.innerHTML = "";
				
				//adding name, coordinates and last update
				$('#left_of_map').append("<h3>"+h[config.name]+"<br><small>Last Update: "+h[config.last_update]+"</small></h3>");
				$('#icon-print').unbind('click').click(function() { 
					//onprint(h[config.name]); 
				});
				
				//recreating divs
				
				var cl = c.length;
					if (cl > 0){
						$('#left_of_map').append("<div><h4><img height='30px' src='img/ocha_icon/"+c[0].icon+".png'>&nbsp;"+c[0].alias+"</h4><div  id='"+c[0].name+"'></div></div>");
						
						///
						var nb_col = 3;
						var rcl = cl-1;
						for (var i = 1; i < nb_col+1; i++){
							$('#below_map').append('<div id="col_'+i+'" class="col-md-'+12/nb_col+'"></div>')
						}
						for (var i = 1; i < rcl; i++){
							var y = i%nb_col
							if (y==0){y=nb_col}
							$('#col_'+y+'').append("<div class='row categories'><h4><img height='30px' src='img/ocha_icon/"+c[i].icon+".png'>&nbsp;"+c[i].alias+"</h4><div id='"+c[i].name+"'></div></div>")
						}
						///
					}
					
				//looping on fields and populating
				for (var i in fields){
					var f = fields[i];
					if (h[f.csv_field]){ //if field is not null in data
						if (f.chart){	
						} //if it's a chart we add nothing here
						else { // if it's not a chart
							var tl = getTrafficLight(f.traffic_light,h[f.csv_field]);
							if (f.type == "list"){//if list
								var array = h[f.csv_field].split(',');
								if (array.length > 1){
									$("#"+f.category+"").append("<p><img class='tl' src='img/tl/tl-"+tl+".svg'>&nbsp;"+f.alias+" :<ul id='list_"+i+"'></ul></p>")
									for (var y in array){
											$("#list_"+i+"").append('<li><b style="color:#4095cd">'+array[y]+'</b></li>')
									}
								}
								else {
									$("#"+f.category+"").append("<p><img class='tl' src='img/tl/tl-"+tl+".svg'>&nbsp;"+f.alias+" : <b style='color:#4095cd'>"+h[f.csv_field]+"</b></p>")
								}
							}
							else {
								$("#"+f.category+"").append("<p><img class='tl' src='img/tl/tl-"+tl+".svg'>&nbsp;"+f.alias+" : <b style='color:#4095cd'>"+h[f.csv_field]+"</b></p>")
							}
						}
					}
				}
				
				// charts
				for (var i in config.charts){
					//create the graphs config
					var g = config.charts[i];

					if (g.name == "age_pyramid"){  // si le graph est la pyramide des ages
						g.config.data.datasets[0].data = [];
						g.config.data.datasets[1].data = [];
						for (var y in fields){
							var f = fields[y]
							if (g.name == f.chart){
								if (h[f.csv_field] > 0){
									if (f.chart_details == "f"){
										g.config.data.datasets[0].data.push(Number(h[f.csv_field]))
									}
									else if (f.chart_details == "m"){
										g.config.data.datasets[1].data.push(Number(0-h[f.csv_field]))
									}
								}
							}
							
						}
						//var max = Math.max.apply(Math, g.config.data.datasets[0].data);
						//var min = Math.min.apply(Math, g.config.data.datasets[1].data);
						//g.config.options.scales.xAxes[0].ticks.min = min;
						//g.config.options.scales.xAxes[0].ticks.max = max;
						g.config.options.tooltips = {
								callbacks: {
									title: function(t,d){
										return d.datasets[t[0].datasetIndex].label+": "+d.labels[t[0].index];
									},
									label: function(t,d) {
										if (t.datasetIndex == 1){
											var invert = Number(0-d.datasets[1].data[t.index])
											return invert;
										}
										else {
											return d.datasets[0].data[t.index];
										}
									}
								}
							}
					}
					else { // autres graphs
						g.config.data.datasets[0].data = [];
						g.config.data.datasets[0].backgroundColor = [];
						g.config.data.labels = [];
						var data_list = [];
						for (var y in fields){
							var f = fields[y]
							if (g.name == f.chart){
								if (h[f.csv_field] > 0){
									data_list.push({"a":f.alias+" ("+Number(h[f.csv_field])+")","v": Number(h[f.csv_field])})
								}
							}
						}
						
						data_list.sort(function(a, b) {
							return parseFloat(b.v) - parseFloat(a.v);
						});
						var other_label = ["Others:"];
						if (data_list.length > 5){
							for (var i in data_list){
								if (i > 4){
									data_list[4].v = (data_list[4].v)+(data_list[i].v);
								}
								if (i > 3){
									var t = data_list[i].a;
									other_label.push(t);
								}
							}
							data_list[4].a = "Others"
							var de = data_list.length - 5;
							data_list.splice(5,de);
							var lb = other_label;
							g.config.options.tooltips = {
								callbacks: {
									label: function(t,d) {
										if (t.index == 4){
										return  lb;
										}
										else{
											return d.labels[t.index];
										}
									}
								}
							}
						}
						for (var i in data_list){
							g.config.data.datasets[0].data.push(data_list[i].v);
							g.config.data.datasets[0].backgroundColor.push(color_list[i]);
							g.config.data.labels.push(data_list[i].a);
						}
						
						
					}
					
					//creates the graphs div
					$("#"+g.category+"").append('<div ="canvas-holder" style="width:100%"><canvas height="'+g.height+'" id="chart_'+g.name+'" /></div>')
					//generates the graphs
					var ctx = document.getElementById("chart_"+g.name+"").getContext("2d");
					var chart = new Chart(ctx, g.config);
				}
			}
			
		})
	});
	

});	
	

