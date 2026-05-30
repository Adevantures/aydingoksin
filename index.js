const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  StreamType,
} = require('@discordjs/voice');

require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const player = createAudioPlayer();

let queue = [
  { title: "Doki Doki Literature Club!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/izzackus/1-01.%20Doki%20Doki%20Literature%20Club%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Ohayou Sayori!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fyaipyad/1-02.%20Ohayou%20Sayori%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Dreams of Love and Literature", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/sbdpmsbc/1-03.%20Dreams%20of%20Love%20and%20Literature.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
];

let currentSongIndex = 0;
let connection = null;

function connectToVoice(channel) {
  const existing = getVoiceConnection(channel.guild.id);
  if (existing) return existing;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  connection.subscribe(player);

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    connection.destroy();
    connection = null;
  });

  return connection;
}

function playSong(channel) {
  const song = queue[currentSongIndex];

  console.log("Playing:", song.title);

  const resource = createAudioResource(song.url, {
    inputType: StreamType.Arbitrary,
  });

  player.play(resource);

  connectToVoice(channel);
}

player.on(AudioPlayerStatus.Idle, () => {
  currentSongIndex = (currentSongIndex + 1) % queue.length;
  const guild = client.guilds.cache.first();
  const channel = guild?.members.me?.voice?.channel;

  if (channel) playSong(channel);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  const voiceChannel = message.member.voice.channel;

  if (['!play', '!skip', '!stop'].includes(command) && !voiceChannel) {
    return message.reply('Bir ses kanalında olmalısın!');
  }

  if (command === '!play') {
    currentSongIndex = 0;
    playSong(voiceChannel);
    message.channel.send(`🎵 Çalıyor: **${queue[currentSongIndex].title}**`);
  }

  if (command === '!skip') {
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    playSong(voiceChannel);
    message.channel.send(`⏭️ Skip → **${queue[currentSongIndex].title}**`);
  }

  if (command === '!stop') {
    player.stop();
    const conn = getVoiceConnection(message.guild.id);
    if (conn) conn.destroy();
    message.channel.send('⏹️ Durduruldu');
  }

  if (command === '!queue') {
    const list = queue.map((s, i) =>
      i === currentSongIndex ? `▶ ${s.title}` : `${i + 1}. ${s.title}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎶 Queue')
      .setDescription(list)
      .setColor('#CCEBFF');

    message.channel.send({ embeds: [embed] });
  }
});

client.once('ready', () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
