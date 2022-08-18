


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
					"theme": template[dayWeek[day]][i].theme,
					"label": label,
					"source": source,
					"link": link,
					"beginHour": template[dayWeek[day]][i].beginHour,
					"beginMinute": template[dayWeek[day]][i].beginMinute,
					"adBefore": template[dayWeek[day]][i].adBefore,
					"forced": template[dayWeek[day]][i].forced
				}
				arrayProg.push(progObj);
			}
			
			//console.log(arrayProg);
			weekJSON.data[day] = arrayProg;
		}
		//console.log(weekJSON);

		for (var j = 0; j < weekJSON.data.length; j++) {
			for (var i = 0; i < weekJSON.data[j].length; i++) {
					
				if(weekJSON.data[j][i].forced === undefined && weekJSON.data[j][i].theme != "franceinfo"){
					let loop = 0;
					let double = weekJSON.data[j][i];
					while(nbDouble(weekJSON.data,double.link) > 1 && loop < 20){
						console.log('In loop: ' + double.theme);
						let resultObjArray = searchObj(playlistsData, double.theme);
						let rand = Math.floor(Math.random() * resultObjArray.length);
						let resultObj = resultObjArray[rand];

						double.source = resultObj.source;
						double.link   = resultObj.link;
						double.label  = resultObj.label;
						loop++;
					}
				}
			}
		}

		resolve(weekJSON);
	});
});

function nbDouble(obj, value){
	let result = 0
	for (var i = 0; i < obj.length; i++) {
		result += obj[i].filter(prog => prog.link == value).length;
	}
	return result;
}

generate.then(data => {
	let date = new Date();
	fs.appendFile('./prog/prog.json', JSON.stringify(data), function (err) {
		if (err) throw err;
		console.log('Saved!');
	});
})

//' + date.getDate() + '-' + date.getMonth() + '-' + date.getFullYear() + '