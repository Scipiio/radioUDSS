


const fs = require('fs');

var dayWeek = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']
var weekJSON = {"data":['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']}
var playlistsData = {}

fs.readFile('./prog/playlistsData.json', 'utf8', (err, data) => {
	if (err) {
		console.error(err);
	return;
	}
	playlistsData = JSON.parse(data).data;
	//console.log(playlistsData)
});

function searchObj(obj, term){
	var results = [];

	for(var i = 0; i < obj.length; i++) {
		for(key in obj[i]) {
			if(obj[i][key].indexOf(term)!=-1) {
				results.push(obj[i]);
			}
		}
	}
	return results;
}

const generate = new Promise((resolve, reject) => {
	fs.readFile('./prog/template.json', 'utf8', (err, data) => {
		if (err) {
			console.error(err);
		return;
		}
		var template = JSON.parse(data)

		for (var day = 0; day < dayWeek.length; day++) {

			console.log('-----------------------\nTreating: ' + dayWeek[day])

			var arrayProg = []
			for (var i = 0; i < template[dayWeek[day]].length; i++) {

				console.log('Program: ' + template[dayWeek[day]][i].title)

				let source = '',
					link   = '',
					title  = ''

				if(template[dayWeek[day]][i].forced){
					let resultObjArray = searchObj(playlistsData, template[dayWeek[day]][i].forced)
					let resultObj = resultObjArray[0];

					source = resultObj.source;
					link   = resultObj.link;
					label  = resultObj.label;

				} else {
					let resultObjArray = searchObj(playlistsData, template[dayWeek[day]][i].theme);
					let rand = Math.floor(Math.random() * resultObjArray.length);
					let resultObj = resultObjArray[rand];

					source = resultObj.source;
					link   = resultObj.link;
					label  = resultObj.label;
				}

				var progObj = {
					"title": template[dayWeek[day]][i].title,
					"label": label,
					"source": source,
					"link": link,
					"beginHour": template[dayWeek[day]][i].beginHour,
					"beginMinute": template[dayWeek[day]][i].beginMinute,
					"adBefore": template[dayWeek[day]][i].adBefore
				}
				arrayProg.push(progObj);
			}
			
			//console.log(arrayProg);
			weekJSON.data[day] = arrayProg;
		}
		//console.log(weekJSON);
		resolve(JSON.stringify(weekJSON));
	});
});


generate.then(data => {
	let date = new Date();
	fs.appendFile('./prog/prog.json', data, function (err) {
		if (err) throw err;
		console.log('Saved!');
	});
})

//' + date.getDate() + '-' + date.getMonth() + '-' + date.getFullYear() + '