const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PLAYLIST = [
  'https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/izzackus/1-01.%20Doki%20Doki%20Literature%20Club%21.mp3',
  'https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fyaipyad/1-02.%20Ohayou%20Sayori%21.mp3',
  'https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/sbdpmsbc/1-03.%20Dreams%20of%20Love%20and%20Literature.mp3'
];

let connection = null;
let player = null;
let trackIndex = 0;

function playTrack() {
  try {
    const resource = createAudioResource(PLAYLIST[trackIndex], { inputType: StreamType.Arbitrary });
    player.play(resource);
    trackIndex = (trackIndex + 1) % PLAYLIST.length;
  } catch (e) {
    console.error('Playback error:', e);
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim().toLowerCase();

  if (content === '!radio start') {
    const member = message.member;
    if (!member?.voice?.channel) return message.reply('Join a voice channel first!');

    if (connection) connection.destroy();

    connection = joinVoiceChannel({
      channelId: member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    player = createAudioPlayer();
    connection.subscribe(player);

    trackIndex = 0;
    playTrack();

    player.on(AudioPlayerStatus.Idle, () => playTrack());
    player.on('error', (e) => console.error('Player error:', e));

    message.reply('📻 Radio started!');
  }

  if (content === '!radio stop') {
    if (player) { player.stop(); player = null; }
    if (connection) { connection.destroy(); connection = null; }
    message.reply('⏹️ Radio stopped.');
  }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));
client.login(process.env.TOKEN);
