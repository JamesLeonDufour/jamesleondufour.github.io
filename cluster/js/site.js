var sector_chart = dc.pieChart("#sector");
var activity_chart = dc.pieChart("#activity");
var organisation_chart = dc.rowChart("#organisation");
var district_chart = dc.geoChoroplethChart("#map");

var cf = crossfilter(data);

cf.sector = cf.dimension(function(d){ return d.category; });
cf.activity = cf.dimension(function(d){ return d.activity; });
cf.organisation = cf.dimension(function(d){ return d.agency; });
cf.district = cf.dimension(function(d){ return d.d_pcode; });

var sector = cf.sector.group();
var activity = cf.activity.group();
var organisation = cf.organisation.group();
var district = cf.district.group();
var all = cf.groupAll();


sector_chart.width(260).height(220)
        .dimension(cf.sector)
        .group(sector)
        .colors(['#ffe082',
                 '#ffd54f',
                 '#ffca28',
                 '#ffc107',
                 '#ffb300',
                 '#ffa000',
                 '#ff8f00',
                 '#ff6f00'
            ])
        .colorDomain([1,8])
        .colorAccessor(function(d, i){return i%7+1;});

activity_chart.width(260).height(220)
        .dimension(cf.activity)
        .group(activity)
        .colors(['#d0f8ce',
                 '#a3e9a4',
                 '#72d572',
                 '#42bd41',
                 '#2baf2b',
                 '#259b24',
                 '#0a8f08',
                 '#0a7e07'
            ])
        .colorDomain([1,8])
        .colorAccessor(function(d, i){return i%7+1;});


organisation_chart.width(330).height(500)
        .margins({top: 0, left: 10, right: 0, bottom: 40})
        .dimension(cf.organisation)
        .group(organisation)
        .elasticX(true)
        .data(function(group) {
            return group.top(15);
        })
        .colors(['#81d4fa',
                 '#4fc3f7',
                 '#29b6f6',
                 '#03a9f4',
                 '#039be5',
                 '#0288d1',
                 '#0277bd',
                 '#01579b'
            ])
        .colorDomain([0,8])
        .colorAccessor(function(d, i){return i%8;});

dc.dataCount("#count-info")
	.dimension(cf)
	.group(all);
        
district_chart.width(450).height(500)
        .dimension(cf.district)
        .group(district)
        .colors(['#DDDDDD', '#ff5722'])
        .colorDomain([0, 1])
        .colorAccessor(function (d) {
            if(d>0){
                return 1;
            } else {
                return 0;
            }
        })
        .overlayGeoJson(dis.features, "District", function (d) {
            return d.properties.A2CodeAlt2;
        })
        .projection(d3.geo.mercator().center([49.5,33]).scale(2500))
        .title(function(d){
            var disname="";
            dis.features.forEach(function(e){
                if(d.key == e.properties.A2CodeAlt2){
                    disname= e.properties.A2NameEn;
                }
            });
            return disname;
        });

dc.renderAll();  


var g = d3.selectAll("#organisation").select("svg").append("g");
    
    g.append("text")
        .attr("class", "x-axis-label")
        .attr("text-anchor", "middle")
        .attr("x", 160)
        .attr("y", 490)
        .text("Number of responses per agency");
