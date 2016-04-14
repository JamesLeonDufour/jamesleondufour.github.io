// random.js
function RandomWord() {
  var requestStr = "http://randomword.setgetgo.com/get.php";

  $.ajax({
    type: "GET",
    url: requestStr,
    dataType: "jsonp",
    jsonpCallback: 'RandomWordComplete'
  });
}

function RandomWordComplete(data) {
  console.log(data);
}


RandomWordComplete()
