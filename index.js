
// #############################################################################################################################
// 													NECESSARY CLASSES
// #############################################################################################################################

// Discord.js classes
const { Client, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');

// Streaming classes
const {
	NoSubscriberBehavior,
	StreamType,
	createAudioPlayer,
	createAudioResource,
	entersState,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	joinVoiceChannel
} = require('@discordjs/voice');
const play = require('play-dl')
const ytfps = require('ytfps');

// Utils classes
const fs = require('fs');
const path = require('path');

// FisherYates method
function shuffle(array) {
	let i = array.length;
	while (i--) {
		const ri = Math.floor(Math.random() * i);
		[array[i], array[ri]] = [array[ri], array[i]];
	}
	return array;
}


// #############################################################################################################################
// 													GLOBALS VARIABLES
// #############################################################################################################################

var NUMBER_ADS = 5;
var CURRENT_PROG_ITERATION = -1;
var CURRENT_PROG = {};

var CURRENT_TRACK_ITERATION = 0;
var CURRENT_TRACK_LIST = [];
var CURRENT_TRACK_SOURCE = '';

var PROG_JSON = {};
const loadProg = new Promise((resolve, reject) => {
	fs.readFile('./prog/prog.json', 'utf8', (err, data) => {
		if (err) {
			console.error(err);
		return;
		}

		PROG_JSON = JSON.parse(data).data
		console.log('Programmation Loaded!');
		resolve(PROG_JSON);
	});
});

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const CHANNEL_ID = '476098208112574464';

const player = createAudioPlayer({
	behaviors: {
		noSubscriber: NoSubscriberBehavior.Play
	},
});

// #############################################################################################################################
// 													MAIN SCRIPT
// #############################################################################################################################

player.on('stateChange', (oldState, newState) => {
	if (oldState.status === AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Playing) {
		console.log('Playing audio output on audio player');
	} else if (newState.status === AudioPlayerStatus.Idle) {
		if(CURRENT_TRACK_SOURCE != 'pub') console.log('Player stopped. Loading next ressource.');
		checkProg()
	}
});

async function connectToChannel(channel) {
	const connection = joinVoiceChannel({
		channelId: channel.id,
		guildId: channel.guild.id,
		adapterCreator: channel.guild.voiceAdapterCreator,
	});

	try {
		await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
		console.log('CONNECTION TO CHANNEL READY\n---------------------------\n');
		return connection;
	} catch (error) {
		connection.destroy();
		throw error;
	}
}

async function generateTrackList() {
	//get prog
	//check hour
	//pick playlist
	//set playlist as listened
	let link = CURRENT_PROG.link;
	CURRENT_TRACK_LIST = [];
	CURRENT_TRACK_ITERATION = 0;

	switch (CURRENT_TRACK_SOURCE) {
		case 'local':{
			CURRENT_TRACK_LIST = await fs.readdirSync(link);
			CURRENT_TRACK_LIST = CURRENT_TRACK_LIST.filter(file => file.endsWith('.mp3'));
			CURRENT_TRACK_LIST = shuffle(CURRENT_TRACK_LIST);
			console.log(CURRENT_TRACK_LIST)
			break;
		}
		case 'pub':{
			console.log('Beginning ad sequence:');

			let pub_list = await fs.readdirSync('./local_tracks/pub/pub_list');
			pub_list = pub_list.filter(file => file.endsWith('.mp3'));

			for (var i = 0; i < NUMBER_ADS; i++) {
				let rand = Math.floor(Math.random() * pub_list.length);
				console.log(' - ' + pub_list[rand].slice(0, -4))
				CURRENT_TRACK_LIST.push('./local_tracks/pub/BIP.mp3', './local_tracks/pub/pub_list/' + pub_list[rand]);
			}
			CURRENT_TRACK_LIST.push('./local_tracks/pub/BIP.mp3', './local_tracks/pub/JINGLE_PUB.mp3');
			CURRENT_TRACK_LIST.unshift('./local_tracks/pub/JINGLE_PUB.mp3');
			break;
		}
		case 'youtube':{
			let res = await ytfps(link);
			CURRENT_TRACK_LIST = shuffle(res.videos);
			break;
		}
		case 'spotify':{
			if (play.is_expired()) {
	            await play.refreshToken() // This will check if access token has expired or not. If yes, then refresh the token.
	        }
			let Playlist = await play.spotify(link)
			await Playlist.fetch()
			for(let i = 1; i <= Playlist.total_pages; i++){
				CURRENT_TRACK_LIST.push(Playlist.page(i))
			}
			CURRENT_TRACK_LIST = CURRENT_TRACK_LIST[0]
			break;
		}
		case 'franceinfo':{
			CURRENT_TRACK_LIST = ['http://icecast.radiofrance.fr/franceinfo-midfi.mp3'];
			break;
		}
		default:
			throw 'Type on generateTrackList not defined!';
	}
}

async function playTrackList() {
	try {
		let currentTrack = CURRENT_TRACK_LIST[CURRENT_TRACK_ITERATION];

		switch (CURRENT_TRACK_SOURCE) {
			case 'local':{

				player.play(createAudioResource('./local_tracks/' + currentTrack));
				console.log('Now playing: ' + currentTrack);

				break;
			}
			case 'pub':{

				player.play(createAudioResource(currentTrack));

				break;
			}
			case 'youtube':{

				let stream = await play.stream(currentTrack.url)
				let resource = createAudioResource(stream.stream, {
					inputType: stream.type
				})

				player.play(resource)
				console.log('Now playing: ' + currentTrack.title)

				break;
			}
			case 'spotify':{

				console.log('Searching: ' + currentTrack.artists[0].name + ' ' + currentTrack.name)
				let searched = await play.search(currentTrack.artists[0].name + ' ' + currentTrack.name, {
					limit: 1
				}) // This will search the found track on youtube.

				let stream = await play.stream(searched[0].url) // This will create stream from the above search
				console.log('Now playing: ' + searched[0].title)

				let resource = createAudioResource(stream.stream, {
					inputType: stream.type
				})
				player.play(resource)

				break;
			}
			case 'franceinfo':{
				player.play(createAudioResource(CURRENT_TRACK_LIST[0]));
				checkProgLoop();
				break;
			}
			default:
				throw 'Type on playTrackList not defined!';
		}

		if(CURRENT_TRACK_ITERATION == CURRENT_TRACK_LIST.length - 1) {
			if(CURRENT_TRACK_SOURCE == 'pub') {
				console.log('Ending ad sequence');
				CURRENT_TRACK_SOURCE = CURRENT_PROG.source;
				await generateTrackList();
			}
			CURRENT_TRACK_ITERATION = 0;
		} else {
			CURRENT_TRACK_ITERATION++;
		}
	} catch (e) {
		console.log('/! Unable to play track');
		console.log(e);
		CURRENT_TRACK_ITERATION++;
	}
}

async function checkProg(){
	let now  = new Date();
	let hourEvent = new Date();

	let dayProg = PROG_JSON[now.getDay()];
	
	let i = 0;
	hourEvent.setHours(dayProg[i].beginHour,dayProg[i].beginMinute,0);

	while (now > hourEvent && dayProg[i] !== undefined){
		i++;
    	hourEvent.setHours(dayProg[i].beginHour,dayProg[i].beginMinute,0);
	}
	i--
	if(CURRENT_PROG_ITERATION != i){
		console.log('Changing program - Updating to ' + dayProg[i].title + ' - '  + dayProg[i].label)

		if(dayProg[i].adBefore) {CURRENT_TRACK_SOURCE = 'pub';}
		else {CURRENT_TRACK_SOURCE = dayProg[i].source;}

		CURRENT_PROG = dayProg[i];
		CURRENT_PROG_ITERATION = i;
		await generateTrackList();
	}
	playTrackList();
}

async function checkProgLoop(){

	setTimeout(() => {
		let now  = new Date();
		let hourEvent = new Date();

		let dayProg = PROG_JSON[now.getDay()];
		
		let i = 0;
		hourEvent.setHours(dayProg[i].beginHour,dayProg[i].beginMinute,0);

		while (now > hourEvent && dayProg[i] !== undefined){
			i++;
	    	hourEvent.setHours(dayProg[i].beginHour,dayProg[i].beginMinute,0);
		}
		i--
		if(CURRENT_PROG_ITERATION != i){
	    	console.log('Stopping Player')
			player.stop();
		} else {
			checkProgLoop();
		}
	},5000)
	
}

// When the client is ready, run this code (only once)
client.once('ready', async () => {
	console.log('BOT READY');

	if (play.is_expired()) {
		await play.refreshToken() // This will check if access token has expired or not. If yes, then refresh the token.
	}

	await loadProg;

	const channel = client.channels.cache.get(CHANNEL_ID);
	const connection = await connectToChannel(channel);

	connection.subscribe(player);

	checkProg();
});

client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;

	const { commandName } = interaction;

	if (commandName === 'server') {
		await interaction.reply(`Server name: ${interaction.guild.name}\nTotal members: ${interaction.guild.memberCount}`);
	}
});


// Login to Discord with your client's token
client.login(token);
