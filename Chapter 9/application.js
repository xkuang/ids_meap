$(function() {
    // REMARK: jQuery calls this function when the html page finishes loading
    //         This way all html elements will have been loaded before the application logic (9.3.1).

    // ********************simple error handling*******************************************
    // REMARK: This error handling is not part of the book tutorial. 
    // It is a preventive measure to intervene in case someone tries to open the index.html file in
    // the browser without an active server

    function onerror(err) {
        var div = $('.err'), p = window.location.protocol, usingHttp = p==='http:' || p==='https:';
		
        $('[data-http='+usingHttp+']', div)
                .removeClass('hide')               // show the http or non-http error message
                .find('em').text(err || '(none)'); // fill in any error detail in the <em> placeholder
        $('main h1').after(div.removeClass('hide')); // put the err message below the top level <h1>
    }

    // load CSV data and when it finishes, invoke function main to initialize the app
    try {
        d3.csv('medicines.csv', function(xhr, data) {
            if (!data) return onerror(xhr.statusText);
            main(data);
        }); 
    } catch (err) { onerror(err.message); }
   // ********************End simple error handling*******************************************
   
    var tableTemplate = $([
        "<table class='table table-hover table-condensed table-striped'>",
        "  <caption></caption>",      
        "  <thead><tr/></thead>",
        "  <tbody></tbody>",
        "</table>"
    ].join('\n'));
	
    CreateTable = function(data,variablesInTable,title){
        var table = tableTemplate.clone();
        var ths = variablesInTable.map(function(v) { return $("<th>").text(v) });
        $('caption', table).text(title);
        $('thead tr', table).append(ths);
        data.forEach(function(row) {
            var tr = $("<tr>").appendTo($('tbody', table));
            variablesInTable.forEach(function(varName) {
                // example:  varName = 'value.stockAvg' 
                //           -> keys = [ 'value', 'stockAvg' ]
                //           -> val = row['value']['stockAvg']    
                var val = row, keys = varName.split('.'); 
                keys.forEach(function(key) { val = val[key] });
                tr.append($("<td>").text(val));
            });
        });
        return table;
    }

    main = function(inputdata){ 
        //Our  data: normally this is fetched from a server but in this case we read it from a local .csv file
        var medicineData = inputdata ;
	
        // Convert date to correct format
        // This way crossfilter will recognise the date variable 
        var dateFormat = d3.time.format("%d/%m/%Y");
        medicineData.forEach(function (d) {
            d.Day = dateFormat.parse(d.Date);     
        })
	
        //We put the variables we shall show in the table in an Array, that way we can loop through them when creating the table code.
        var variablesInTable = ['MedName','StockIn','StockOut','Stock','Date','LightSen']
        // only show a sample of the data
        var sample = medicineData.slice(0,5);
        //Create the table
        var inputTable = $("#inputtable");
        inputTable
                .empty()
                .append(CreateTable(sample,variablesInTable,"The input table"));
	
        //************************************************
        //  Adding Crossfilter.js
        //************************************************

        //Initialize a Crossfilter instance
        CrossfilterInstance = crossfilter(medicineData);
	
        // Let's create our first dimension: the medicine name dimension 
        var medNameDim = CrossfilterInstance.dimension(function(d) {return d.MedName;});
	
        //    FILTERING DATA
	
        // We can now filter data 
        var dataFiltered= medNameDim.filter('Grazax 75 000 SQ-T')
        // and show the filtered data using our CreateTable function
        var filteredTable = $('#filteredtable');
        filteredTable
                .empty()
                .append(CreateTable(dataFiltered.top(5),variablesInTable,'Our First Filtered Table'));
//	let's register another dimension: the date dimension
        var DateDim = CrossfilterInstance.dimension(function(d) {return d.Day;});
//        Now we can sort on date instead of medicine name
        filteredTable
                .empty()
                .append(CreateTable(DateDim.bottom(5),variablesInTable,'Our First Filtered Table'));
        
        //   MAPREDUCE   
        //reduce count
        var countPerMed = medNameDim.group().reduceCount();
        variablesInTable = ["key","value"]
        filteredTable
                .empty()
                .append(CreateTable(countPerMed.top(Infinity),variablesInTable,'Reduced Table'));
	  
        // A Custom Reduce function require 3 components: an initiation, an add and a remove function
        // Initial reduce function, will set starting values of the p object
        var reduceInitAvg = function(p,v){
            return {count: 0, stockSum : 0, stockAvg:0};
        }
        //reduce function that is called when adding a record
        var reduceAddAvg = function(p,v){
            p.count += 1;
            p.stockSum  = p.stockSum  + Number(v.Stock);
            p.stockAvg = Math.round(p.stockSum  / p.count);
            return p;
        }
        //reduce function that is called when removing a record
        var reduceRemoveAvg = function(p,v){
            p.count -= 1;
            p.stockSum  = p.stockSum  -  Number(v.Stock);
            p.stockAvg = Math.round(p.stockSum  / p.count);
            return p;
        }
        //.reduce() takes the 3 functions(reduceInitAvg(),reduceAddAvg() and reduceRemoveAvg()) as input arguments
        dataFiltered = medNameDim.group().reduce(reduceAddAvg,reduceRemoveAvg,reduceInitAvg)
        //business as always: draw the result table
        variablesInTable = ["key","value.stockAvg"]
        filteredTable
                .empty()
                .append(CreateTable(dataFiltered.top(Infinity),variablesInTable,'Reduced Table'));
 
        medNameDim.filterAll()
		 
        //************************************************
        //  Adding DC.js
        //************************************************
	  
        //  Stock over time data
        var SummatedStockPerDay = DateDim.group().reduceSum(function(d){return d.Stock;})
        //  The Line Chart
        var minDate = DateDim.bottom(1)[0].Day;
        var maxDate = DateDim.top(1)[0].Day;
        var StockOverTimeLineChart = dc.lineChart("#StockOverTime");
	
        //  deliveries per day graph 
        StockOverTimeLineChart
                .width(null) // null means size to fit container
                .height(400)
                .dimension(DateDim)
                .group(SummatedStockPerDay)
                .x(d3.time.scale().domain([minDate,maxDate]))
                .xAxisLabel("Year 2015")
                .yAxisLabel("Stock")
                .margins({left: 60, right: 50, top: 50, bottom: 50})
		
        //   Average stock per medicine rowchart
        var AverageStockPerMedicineRowChart = dc.rowChart("#StockPerMedicine"); 
	 
        var AvgStockMedicine =  medNameDim.group().reduce(reduceAddAvg,reduceRemoveAvg,reduceInitAvg); 
        AverageStockPerMedicineRowChart
                .width(null) 
        // null means size to fit container
                .height(1200)
                .dimension(medNameDim)
                .group(AvgStockMedicine)
                .margins({top: 20, left: 10, right: 10, bottom: 20})
                .valueAccessor(function (p) {return p.value.stockAvg;}); 
	
        //light sensitivity Stock
        var lightSenDim = CrossfilterInstance.dimension(function(d) {return d.LightSen;}); 
        var SummatedStockLight =  lightSenDim.group().reduceSum(function(d) {return d.Stock;}); 
	
        var LightSensitiveStockPieChart = dc.pieChart("#LightSensitiveStock");
	
        LightSensitiveStockPieChart
                .width(null) // null means size to fit container
                .height(300)
                .dimension(lightSenDim)
                .radius(90)
                .group(SummatedStockLight)  
//	The resetFilters() function will reset our dc.js data and redraw the graphs
        resetFilters = function(){
            StockOverTimeLineChart.filterAll();
            LightSensitiveStockPieChart.filterAll();
            AverageStockPerMedicineRowChart.filterAll();
            dc.redrawAll();
        }
//        When an element with class btn-success is clicked (our reset button), resetFilters() is called. 
        $('.btn-success').click(resetFilters);

        //Render the graph
        dc.renderAll(); 
    }
})
	
    
    
    

//    //****************(9.3.4)********************************
//    //Let's do more interesting filters: numeric ones (9.3.4)
//
//    //We first need to define the other dimensions on our crossfilter object( 9.3.4)
//    var stockDimension = CrossfilterInstance.dimension(function(d) {return d.stock;}); 
//
//    //A numeric datafilterà on the number of items in stock. (9.3.4)
//    //We want to see all the medicines with a stock between 1 and 50 (9.3.4)
//    //REMARK: 50 is not included. (9.3.4)
//    dataFiltered = stockDimension.filter([1,50])
//    CreateTable(dataFiltered.top(Infinity),variablesInTable,'outputdatatablediv','Our Second Filtered Table')
//
//    //Something has gone wrong, we still see the same observation (9.3.4)
//
//    //We need to reset the filter we set earlier. these filter actually stack. (9.3.4)
//    medNameDim.filterAll()
//    //There is always only one filter per dimension. Setting a second filter will override the first one.(9.3.4)
//    dataFiltered = stockDimension.filter([1,51])
//    dataFiltered = stockDimension.filter([80,121])
//    CreateTable(dataFiltered.top(Infinity),variablesInTable,'outputdatatablediv','Our Third Filtered Table')
//
//    //If we do want 2 filters to be active at the same time, we can. All we need to do is write a function and
//    //pass it as the argument to the filter() method. (9.3.4)
//
//    var customFilterFunction = function(d,i){
//        if(1<= d && d<=50 || 80<= d && d <= 120)
//        {return d;}
//    }
//    dataFiltered = stockDimension.filter(customFilterFunction)
//    CreateTable(dataFiltered.top(Infinity),variablesInTable,'outputdatatablediv','Our Fourth Filtered Table')
//
//    //****************(9.3.5)********************************
//    //Actual MapReduce in Crossfilter
//
//    //let's start with a clean slate and remove the dimensions we used
//    stockDimension.dispose()
//    medNameDim.dispose()
//
//    //Then create an object which will contain all our dimensions
//    var allDimensions = {};
//    //This utility function will initiate all our dimensions
//    var initiateDimensions = function(dimensionArray){
//        for(var i = 0; i<dimensionArray.length  ; i++){
//            allDimensions[dimensionArray[i]+"Dim"] = CrossfilterInstance.dimension(function(d) {return d[dimensionArray[i]];});
//        }
//    }
//    //This utility function will remove filters on all our dimensions
//    var removeAllFilters = function(dimenionArray){
//        for(var i = 0; i<dimenionArray.length  ; i++){
//            allDimensions[dimenionArray[i]+"Dim"].filterAll();
//        }
//    }
//    initiateDimensions(variablesInTable)
//    removeAllFilters(variablesInTable)
//
//    //First mapreduce function: the tempSent dimension is the group by dimension
//    dataFiltered = allDimensions.tempSentDim.group().reduceSum(function(d) {return d.stock;})
//    //The ball game has changed, the reduceSum function will output 2 variables: 'key' and 'value'
//    console.log(dataFiltered.top(Infinity))
//    //We will accomodate for this by creating a variables with object with both a name and a label
//    var variablesToShow = [{name:'key',label:'tempSent'},{name:'value',label:'Summated Stock'}]
//    //Let's revisit our Create table function and adapt it for the new situation
//    CreateTable = function(data,variablesInTable,divId,title){
//        var tableHtml = '<table><thead><tr>'+title+'</tr></thead><tbody>'; 
//        tableHtml += '<tr>'
//        for (var j = 0, len = variablesInTable.length; j < len; ++j) {
//            tableHtml += '<th>' + variablesInTable[j]['label'] + '</th>' //variablesInTable[j] --> variablesInTable[j]['label']
//        }
//        tableHtml += '</tr>'
//        for (var i = 0, len = data.length; i < len; ++i) {
//            tableHtml += '<tr>';
//            for (var j = 0, rowLen = variablesInTable.length; j < rowLen; ++j ) {
//                if(variablesInTable[j]['name'] == 'key'){tableHtml += '<td>' + data[i]['key']+ '</td>';}
//                else if (variablesInTable[j]['name'] == 'value'){tableHtml += '<td>' + data[i]['value']+ '</td>';}
//                else tableHtml += '<td>' + data[i]['value'][variablesInTable[j]['name']] + '</td>';
//                //data[i][variablesInTable[j] --> data[i][variablesInTable[j]['name']]
//            }
//            tableHtml += "</tr>";
//        }
//        tableHtml += '</tbody></table>';
//        $(tableHtml).appendTo('#'+divId);
//    }
//    //Draw another table
//    CreateTable(dataFiltered.top(Infinity),variablesToShow,'outputdatatablediv','Our Fifth output Table')
//    //Add a filter to another dimension, it will take this into account
//    allDimensions.packagingVolumeDim.filter(function(d){return d > 35})
//    CreateTable(dataFiltered.top(Infinity),variablesToShow,'outputdatatablediv','Our Sixt output Table')
//
//    //Applying a filter on the dimension used in the group by will not work. 
//    allDimensions.tempSentDim.filter("Y")
//    CreateTable(dataFiltered.top(Infinity),variablesToShow,'outputdatatablediv','Our Seventh output Table')
//
//    //However you can Apply a mapreduce without asigning a specific group
//    dataFiltered = CrossfilterInstance.groupAll().reduceSum(function(d) {return d.stock;})
//    $('<b> Medicines that require cooling and take up more space than 35cm&#179 per unit: ' + dataFiltered.value() + ' in stock </b> <br>').appendTo('#outputdatatablediv');
//
//    //Writing our own mapreduce function consists of providing 3 input functions to the crossfilter reduce() function
//
//    //First make sure to remove all the filters that are in place. 
//    removeAllFilters(variablesInTable)
//
//    //Initial reduce function, will set starting values of the p object
//    reduceInitAvg = function(p,v){
//        return {count: 0, packagingVolume_sum: 0, packagingVolume_Avg:0};
//    }
//    //reduce function that is called when adding a record
//    reduceAddAvg = function(p,v){
//        p.count += 1;
//        p.packagingVolume_sum = p.packagingVolume_sum + v.packagingVolume;
//        p.packagingVolume_Avg = p.packagingVolume_sum / p.count;
//        return p;
//    }
//    //reduce function that is called when removing a record
//    reduceRemoveAvg = function(p,v){
//        p.count -= 1;
//        p.packagingVolume_sum = p.packagingVolume_sum - v.packagingVolume;
//        p.packagingVolume_Avg = p.packagingVolume_sum / p.count;
//        return p;
//    }
//    //.reduce() takes the 3 functions as input arguments
//    var dataFiltered = allDimensions.packagingTypeDim.group().reduce(reduceAddAvg,reduceRemoveAvg,reduceInitAvg)
//    //business as always: draw the result table
//    var variablesToShow = [{name:'key',label:'Packaging Type'},{name:'packagingVolume_Avg',label:'Average Volume'}]
//    CreateTable(dataFiltered.top(Infinity),variablesToShow,'outputdatatablediv','Our Eight output Table')
//
//    //A more generalised function will make abstraction of the measure we like to reduce. 
//    doAverageMapReduce = function(dimensionName,variableOut,variableIn){
//        reduceAddAverage = function(p,v,variableOut,variableIn){ 
//            p[variableOut+"_sum"] += Number(v[variableIn]);
//            p[variableOut+"_total"] += 1;
//            p[variableOut] = p[variableOut+"_sum"] / p[variableOut+"_total"]
//        }
//        reduceRemoveAverage = function(p,v,variableOut,variableIn){
//            p[variableOut+"_sum"] -= Number(v[variableIn]);
//            p[variableOut+"_total"] -= 1;
//            p[variableOut] = p[variableOut+"_sum"] / p[variableOut+"_total"];
//        }
//        var dataFiltered = allDimensions[dimensionName].group().reduce(
//                function reduceAdd(p,v) {reduceAddAverage(p,v,variableOut,variableIn); return p; }, 
//                function reduceRemove(p,v) {  reduceRemoveAverage(p,v,variableOut,variableIn);return p; }, 
//                function reduceInit(p,v) {  
//                    var initObject= {};
//            initObject[variableOut+"_sum"] = 0;
//            initObject[variableOut+"_total"] = 0;
//            initObject[variableOut] = 0;
//            return initObject;
//        }
//                )
//        return dataFiltered;
//    }
//
//    //we now call this function with different arguments: 
//    //1) the dimension we like to group by
//    //2) the name of the output variable we like to create, which is always an average of the third argument
//    //3) the numerical dimension we like to reduce
//    dataFiltered = doAverageMapReduce('packagingTypeDim','packagingVolume_Avg','packagingVolume')
//    console.log(dataFiltered.top(Infinity));
//    var variablesToShow = [{name:'key',label:'Packaging Type'},{name:'packagingVolume_Avg',label:'Average Packaging Volume'}]
//    CreateTable(dataFiltered.top(Infinity),variablesToShow,'outputdatatablediv','Our Ninth output Table')
//
//    //In the same manner we can create a generalised version of a "count unique" reduce function
//    doUniqueCountMapReduce = function(dimensionName,variableOut,variableIn){
//        reduceAddCountUnique = function(p,v,variableOut,variableIn){ 
//            if(p[variableOut+"_list"]){
//                if(p[variableOut+"_list"][v[variableIn]]){
//                    p[variableOut+"_list"][v[variableIn]] +=1;
//                }else {
//                    p[variableOut+"_list"][v[variableIn]] = 1;
//                    p[variableOut] += 1;
//                }   
//            }else p[variableOut+"_list"] = {};
//        }
//        reduceRemoveCountUnique = function(p,v,variableOut,variableIn){
//            if(p[variableOut+"_list"][v[variableIn]]){
//                p[variableOut+"_list"][v[variableIn]] -=1;
//                if(p[variableOut+"_list"][v[variableIn]] == 0){
//                    p[variableOut] -= 1; 
//                }
//            }
//        }
//        var dataFiltered = allDimensions[dimensionName].group().reduce(
//                function reduceAdd(p,v) {reduceAddCountUnique(p,v,variableOut,variableIn); return p; }, 
//                function reduceRemove(p,v) {  reduceRemoveCountUnique(p,v,variableOut,variableIn);return p; }, 
//                function reduceInit(p,v) {  
//                    var initObject= {};
//            initObject[variableOut+"_list"] = {};
//            initObject[variableOut] = 0;
//            return initObject;
//        }
//                )
//        return dataFiltered;
//    }
//    //create the dataset and draw the table
//    dataFiltered = doUniqueCountMapReduce('packagingTypeDim','unit_CountUnique','unit')
//    var variablesToShow = [{name:'key',label:'Packaging Type'},{name:'unit_CountUnique',label:'Unique Measuring Unit'}]
//    CreateTable(dataFiltered.top(Infinity),variablesToShow,'outputdatatablediv','Our Tenth output Table')
//
//    //Making an interactive Table (9.4)
//    //  We need to revisit the table creation code, make it just a little bit more 
//    CreateTable = function(data,variablesInTable,divId,title){
//        var tableHtml = '<table><thead><tr>'+title+'</tr></thead><tbody>'; 
//        tableHtml += '<tr>'
//        for (var j = 0, len = variablesInTable.length; j < len; ++j) {
//            tableHtml += '<th>' + variablesInTable[j]['label'] + '</th>' //variablesInTable[j] --> variablesInTable[j]['label']
//        }
//        tableHtml += '</tr>'
//        for (var i = 0, len = data.length; i < len; ++i) {
//            tableHtml += '<tr>';
//            for (var j = 0, rowLen = variablesInTable.length; j < rowLen; ++j ) {
//                if(variablesInTable[j]['name'] == 'key'){tableHtml += '<td>' + data[i]['key']+ '</td>';}
//                else if (variablesInTable[j]['name'] == 'value'){tableHtml += '<td>' + data[i]['value']+ '</td>';}
//                else tableHtml += '<td>' + data[i]['value'][variablesInTable[j]['name']] + '</td>';
//                //data[i][variablesInTable[j] --> data[i][variablesInTable[j]['name']]
//            }
//            tableHtml += "</tr>";
//        }
//        tableHtml += '</tbody></table>';
//        $("#"+divId).html(tableHtml);  // $(tableHtml).appendTo('#'+divId); --> $("#"+divId).html(tableHtml); 
//        //Instead of appending new tables to keep track of what we have done in the^past, we want the table to be replaced every time
//        //    the create table function is called
//    }
//
//    //The calculate function can be called on demand of the user and makes use of the previously described crossfilter functions.
//    //first we fetch the dropdon list chosen values
//    //then we use those to determine which reduce function needs to happen and on what variables
//    var calculate = function(){
//        var groupbyDimension = $("#groupbyDimension").val();  
//        var numericDimension = $("#numericDimension").val();
//        var calculationMethod = $("#calculationMethod").val();
//        if (calculationMethod  == "Count" ){
//            var data = allDimensions[groupbyDimension].group().reduceCount(function(d) {return d[numericDimension];});
//            var variablesToShow = [{name:'key',label: groupbyDimension},{name:'value',label:numericDimension+'_Count'}];
//        }
//        else if (calculationMethod  == "Sum" ){
//            var data = allDimensions[groupbyDimension].group().reduceSum(function(d) {return d[numericDimension];});
//            var variablesToShow = [{name:'key',label: groupbyDimension},{name:'value',label:numericDimension+'_Sum'}];
//        }
//        else if (calculationMethod  == "Average" ){
//            var data = doAverageMapReduce(groupbyDimension,numericDimension+'_Avg',numericDimension);
//            var variablesToShow = [{name:'key',label: groupbyDimension},{name:numericDimension+'_Avg',label:numericDimension+'_Avg'}];
//        }
//        CreateTable(data.top(Infinity),variablesToShow,'reportTable','The Fancy report table');
//    }


