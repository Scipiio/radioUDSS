
// #############################################################################################################################
// 													NECESSARY CLASSES
// #############################################################################################################################

// Discord.js classes
const { ActionRowBuilder,
		ButtonBuilder, 
		ButtonStyle, 
		EmbedBuilder, 
		Client, 
		GatewayIntentBits } = require('discord.js');
const { token } = require('./.data/config.json');

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
const generateWeekProg = require("./generateWeekProg.js");

// Utils classes
const fs = require('fs');
const path = require('path');
const cluster = require('cluster');

// FisherYates method shuffle
function shuffle(array) {
	let i = array.length;
	while (i--) {
		const ri = Math.floor(Math.random() * i);
		[array[i], array[ri]] = [array[ri], array[i]];
	}
	return array;
}

if(cluster.isMaster) {

	cluster.fork();
	cluster.on('disconnect', function(worker)
	{
		console.error('!! CRASHED !!');
		cluster.fork();
	});

} else {

	// #############################################################################################################################
	// 													GLOBALS VARIABLES
	// #############################################################################################################################

	const COOL_S = "   ^\n  / \\\n /   \\\n/     \\\n|  |  |\n|  |  |\n\\  \\  /\n \\  \\/\n /\\  \\\n/  \\  \\\n|  |  |\n|  |  |\n\\     /\n \\   /\n  \\ /\n   v   alut"
	const separator = "\n------------------------------------\n"
	var NUMBER_ADS = 4;
	var CURRENT_PROG_ITERATION = -1;
	var CURRENT_PROG = {};

	var CURRENT_TRACK_ITERATION = 0;
	var CURRENT_TRACK_LIST = [];
	var CURRENT_TRACK_SOURCE = '';
	var NOW_PLAYING = '';

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
	const CHANNEL_ID_VOICE = '476098208112574464';
	const CHANNEL_ID_TEXT  = '758698867050676314';
	var MAIN_MESSAGE = ''
	var IS_CURRENT_VIEW = true;

	const player = createAudioPlayer({
		behaviors: {
			noSubscriber: NoSubscriberBehavior.Play
		},
	});

	// #############################################################################################################################
	// 													MAIN SCRIPT
	// #############################################################################################################################

	player.on('stateChange', async (oldState, newState) => {
		if (oldState.status === AudioPlayerStatus.Idle && newState.status === AudioPlayerStatus.Playing) {
			console.log(separator);
			console.log('/! TRY TO PLAY SOMETHING WHILE PLAYER ACTIVE');
		} else if (newState.status === AudioPlayerStatus.Idle) {

			if(CURRENT_TRACK_SOURCE == 'END') {
				const loadNewProg = new Promise((resolve, reject) => {
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
				await loadNewProg;
			}
			checkProg();
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
		return new Promise(async (resolve) => {

			let link = CURRENT_PROG.link;
			CURRENT_TRACK_LIST = [];
			CURRENT_TRACK_ITERATION = 0;

			switch (CURRENT_TRACK_SOURCE) {
				case 'END':{
					fs.unlink('./prog/prog.json', async () => {
						await generateWeekProg.run();
						await loadProg;
					});
					CURRENT_TRACK_LIST = ['https://www.youtube.com/watch?v=cI6ygcSoGzg'];
					break;
				}
				case 'local':{
					CURRENT_TRACK_LIST = await fs.readdirSync(link);
					CURRENT_TRACK_LIST = CURRENT_TRACK_LIST.filter(file => file.endsWith('.mp3'));
					CURRENT_TRACK_LIST = shuffle(CURRENT_TRACK_LIST);
					console.log(CURRENT_TRACK_LIST)
					break;
				}
				case 'pub':{
					console.log(separator);
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

					if(CURRENT_PROG.theme == 'emission' || CURRENT_PROG.theme == 'podcast') {console.log('sponsor');}

					NOW_PLAYING = 'Séquence pub';
					if(IS_CURRENT_VIEW) updateMessage();

					break;
				}
				case 'youtube':{
					if(link.startsWith('search:')) {
						let searched = await play.search(link.split(':')[1], {
							limit: 1
						})
						CURRENT_TRACK_LIST = [searched[0]];
					} else if(link.startsWith('video:')) {
						CURRENT_TRACK_LIST = [{
							title: CURRENT_PROG.label,
							url: link.split(':')[1]
						}]
						console.log(CURRENT_TRACK_LIST)
					} else {
						let res = await ytfps(link);
						CURRENT_TRACK_LIST = shuffle(res.videos);
					}
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
					CURRENT_TRACK_LIST = shuffle(CURRENT_TRACK_LIST[0]);
					break;
				}
				case 'franceinfo':{
					CURRENT_TRACK_LIST = ['http://icecast.radiofrance.fr/franceinfo-midfi.mp3'];
					break;
				}
				default:
					throw 'Type on generateTrackList not defined!';
			}
			resolve(true);
		});
	}

	async function playTrackList() {
		try {
			let currentTrack = CURRENT_TRACK_LIST[CURRENT_TRACK_ITERATION];

			switch (CURRENT_TRACK_SOURCE) {
				case 'END':{

					let stream = await play.stream(currentTrack)
					let resource = createAudioResource(stream.stream, {
						inputType: stream.type
					})

					player.play(resource)
					NOW_PLAYING = 'Génération de la nouvelle programmation, merci de patienter.';

					break;
				}
				case 'local':{

					player.play(createAudioResource('./local_tracks/' + currentTrack));
					NOW_PLAYING = currentTrack

					break;
				}
				case 'pub':{

					player.play(createAudioResource(currentTrack));
					NOW_PLAYING = 'Séquence Pub';

					break;
				}
				case 'youtube':{

					let stream = await play.stream(currentTrack.url);
					let resource = createAudioResource(stream.stream, {
						inputType: stream.type
					})

					player.play(resource);
					NOW_PLAYING = currentTrack.title;

					break;
				}
				case 'spotify':{

					console.log('Searching: ' + currentTrack.artists[0].name + ' ' + currentTrack.name);
					let searched = await play.search(currentTrack.artists[0].name + ' ' + currentTrack.name, {
						limit: 1
					}) // This will search the found track on youtube.

					let stream = await play.stream(searched[0].url) // This will create stream from the above search
					NOW_PLAYING = searched[0].title;

					let resource = createAudioResource(stream.stream, {
						inputType: stream.type
					})
					player.play(resource);

					break;
				}
				case 'franceinfo':{
					player.play(createAudioResource(CURRENT_TRACK_LIST[0]));
					NOW_PLAYING = 'Actualité France Info'
					checkProgLoop();
					break;
				}
				default:
					throw 'Type on playTrackList not defined!';
			}

			if(IS_CURRENT_VIEW && CURRENT_TRACK_SOURCE != 'pub') updateMessage();
			if(CURRENT_TRACK_SOURCE != 'pub') console.log('Now playing: ' + NOW_PLAYING)

			if(CURRENT_TRACK_ITERATION == CURRENT_TRACK_LIST.length - 1) {
				if(CURRENT_TRACK_SOURCE == 'pub') {
					console.log('Ending ad sequence');
					console.log(separator);
					CURRENT_TRACK_SOURCE = CURRENT_PROG.source;
					await generateTrackList();
				}
				if (play.is_expired()) {
					await play.refreshToken() // This will check if access token has expired or not. If yes, then refresh the token.
				}
				CURRENT_TRACK_ITERATION = 0;
			} else {
				CURRENT_TRACK_ITERATION++;
			}
		} catch (e) {
			console.log('/! Unable to play track');
			console.log(e);
			if(CURRENT_TRACK_ITERATION == CURRENT_TRACK_LIST.length - 1) {
				CURRENT_TRACK_ITERATION = 0;
			} else {
				CURRENT_TRACK_ITERATION++;
			}
            playTrackList();
		}
	}

	async function checkProg(){
		let now  = new Date(); //'Mon Aug 22 2022 23:34:08 GMT+0200'
		let hourEvent = new Date();

		let dayProg = PROG_JSON[now.getDay()];
		
		let i = 0;
		hourEvent.setHours(dayProg[i + 1].beginHour,dayProg[i + 1].beginMinute,0);

		if(now < hourEvent){
			if(dayProg[i].beginHour == 0 && dayProg[i].beginMinute == 0) {
				i = 0;
			} else {
				dayProg = PROG_JSON[now.getDay() - 1];
				i = dayProg.length - 1;
			}
		} else {
			let stop = false;
			while (now > hourEvent && !stop){
				i++;
				if(dayProg[i + 1] === undefined) stop = true;
				else await hourEvent.setHours(dayProg[i + 1].beginHour,dayProg[i + 1].beginMinute,0); 
			}
		}
		

		if(CURRENT_PROG_ITERATION != i){
			console.log(separator);
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

		let now = new Date();
		let dayProg = PROG_JSON[now.getDay()];
        
		let hourEvent = new Date();
			hourEvent.setHours(dayProg[CURRENT_PROG_ITERATION + 1].beginHour,dayProg[CURRENT_PROG_ITERATION + 1].beginMinute,5);
        
		setTimeout(async () => {
			now = new Date();
			if (now < hourEvent){
				checkProgLoop();
			} else {
		    	console.log('Stopping Player')
				player.stop();
				checkProg();
			}
		},5000)
	}

	function updateMessage(){
		const embed = new EmbedBuilder()
			.setColor(0xDAF7A6)
			.setTitle('Radio UDSS, Hit Music Only')
			.setDescription('Programme en cours : ' + CURRENT_PROG.title + ' - ' + CURRENT_PROG.label + '\n\n' + NOW_PLAYING);

		const comp = getMessageButton('current');

		MAIN_MESSAGE.edit({ content: '', ephemeral: false, embeds: [embed], components: comp })
	}

	function getMessageButton(id){
		const row1 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('current')
					.setLabel('En cours')
					.setStyle(id == 'current' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			).addComponents(
				new ButtonBuilder()
					.setCustomId('6')
					.setLabel('Samedi')
					.setStyle(id == '6' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			).addComponents(
				new ButtonBuilder()
					.setCustomId('0')
					.setLabel('Dimanche')
					.setStyle(id == '0' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			);
			
		const row2 = new ActionRowBuilder()
			.addComponents(
				new ButtonBuilder()
					.setCustomId('1')
					.setLabel('Lundi')
					.setStyle(id == '1' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			).addComponents(
				new ButtonBuilder()
					.setCustomId('2')
					.setLabel('Mardi')
					.setStyle(id == '2' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			).addComponents(
				new ButtonBuilder()
					.setCustomId('3')
					.setLabel('Mercredi')
					.setStyle(id == '3' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			).addComponents(
				new ButtonBuilder()
					.setCustomId('4')
					.setLabel('Jeudi')
					.setStyle(id == '4' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			).addComponents(
				new ButtonBuilder()
					.setCustomId('5')
					.setLabel('Vendredi')
					.setStyle(id == '5' ? ButtonStyle.Primary : ButtonStyle.Secondary),
			);
			return [row1,row2];
	}

	// When the client is ready, run this code (only once)
	client.once('ready', async () => {
		console.log('Radio UDSS started     ||');
		console.log(COOL_S);

		if (play.is_expired()) {
			await play.refreshToken() // This will check if access token has expired or not. If yes, then refresh the token.
		}

		MAIN_MESSAGE = await client.channels.cache.get(CHANNEL_ID_TEXT).messages.fetch('1009781815151697961');
		const embed = new EmbedBuilder()
			.setColor(0xDAF7A6)
			.setTitle('Radio UDSS, Hit Music Only')
			.setDescription('Bienvenue sur la Radio UDSS, la radio 100% DEUSSIENNE !');

		MAIN_MESSAGE.edit({ content: '', ephemeral: false, embeds: [embed], components: MAIN_MESSAGE.components });

		await loadProg;

		const channel = client.channels.cache.get(CHANNEL_ID_VOICE);
		const connection = await connectToChannel(channel);

		connection.subscribe(player);

		checkProg();
	});

	client.on('interactionCreate', async interaction => {
		if (!interaction.isChatInputCommand()) return;

		const { commandName } = interaction;

		if (commandName === 'restart') {
			await interaction.reply(`Suicide restart`);
			suicide.reset();
		}
	});

	client.on('interactionCreate', interaction => {
		if (!interaction.isButton()) return;

		const comp = getMessageButton(interaction.customId);
		
		if(interaction.customId == 'current'){
			IS_CURRENT_VIEW = true;
			const embed = new EmbedBuilder()
				.setColor(0xDAF7A6)
				.setTitle('Radio UDSS, Hit Music Only')
				.setDescription('Programme en cours : ' + CURRENT_PROG.title + ' - ' + CURRENT_PROG.label + '\n\n' + NOW_PLAYING);

			interaction.update({ content: '', ephemeral: false, embeds: [embed], components: comp });
		} else {
			IS_CURRENT_VIEW = false;
			let dayWeek = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi']
			let text = '';
			for (var i = 0; i < PROG_JSON[parseInt(interaction.customId,'10')].length; i++) {
				let prog = PROG_JSON[parseInt(interaction.customId,'10')][i];
				let minute = prog.beginMinute == '0' ? prog.beginMinute + '0' : prog.beginMinute;

				text += ' ●   ' + prog.beginHour + 'h' + minute + ' :　' + prog.title + ' - ' + prog.label + '\n';
			}
			const embed = new EmbedBuilder()
				.setColor(0xDAF7A6)
				.setTitle('Radio UDSS, Hit Music Only')
				.setDescription('Programme du ' + dayWeek[parseInt(interaction.customId,'10')] + ' : \n\n' + text);

			interaction.update({ content: '', ephemeral: false, embeds: [embed], components: comp });
		}
	});


	// Login to Discord with your client's token
	client.login(token);
}