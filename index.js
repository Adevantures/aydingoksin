const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
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
  {
    title: "Doki Doki Literature Club!",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/izzackus/1-01.%20Doki%20Doki%20Literature%20Club%21.mp3",
  },
  {
    title: "Ohayou Sayori!",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fyaipyad/1-02.%20Ohayou%20Sayori%21.mp3",
  },
  {
    title: "Dreams of Love and Literature",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/sbdpmsbc/1-03.%20Dreams%20of%20Love%20and%20Literature.mp3",
  },
];

let currentSongIndex = 0;
let activeChannel = null;

async function connect(channel) {
  let connection = getVoiceConnection(channel.guild.id);

  if (connection && connection.state.status === VoiceConnectionStatus.Ready) {
    return connection;
  }

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  connection.subscribe(player);

  await entersState(connection, VoiceConnectionStatus.Ready, 15_000);

  return connection;
}

async function playSong(channel) {
  const song = queue[currentSongIndex];

  console.log("▶ Playing:", song.title);

  await connect(channel);

  const resource = createAudioResource(song.url); // 🔥 FIX: StreamType kaldırıldı

  player.stop(true); // 🔥 FIX: overlap bug

  setTimeout(() => {
    player.play(resource);
  }, 200);

  activeChannel = channel;
}

// 🔥 FIX: Idle yerine stateChange kullanıyoruz
player.on('stateChange', (oldState, newState) => {
  if (
    oldState.status === AudioPlayerStatus.Playing &&
    newState.status === AudioPlayerStatus.Idle
  ) {
    console.log("🎵 Song finished");

    currentSongIndex = (currentSongIndex + 1) % queue.length;

    if (activeChannel) {
      playSong(activeChannel);
    }
  }
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
    await playSong(voiceChannel);
    message.channel.send(`🎵 Çalıyor: **${queue[currentSongIndex].title}**`);
  }

  if (command === '!skip') {
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    await playSong(voiceChannel);
    message.channel.send(`⏭️ Skip → **${queue[currentSongIndex].title}**`);
  }

  if (command === '!stop') {
    player.stop();
    const conn = getVoiceConnection(message.guild.id);
    if (conn) conn.destroy();

    activeChannel = null;

    message.channel.send('⏹️ Durduruldu');
  }

  if (command === '!queue') {
    const list = queue
      .map((s, i) =>
        i === currentSongIndex ? `▶ ${s.title}` : `${i + 1}. ${s.title}`
      )
      .join('\n');

    const embed = new EmbedBuilder()
      .setTitle('🎶 Queue')
      .setDescription(list)
      .setColor('#CCEBFF');

    message.channel.send({ embeds: [embed] });
  }
});

client.once('clientReady', () => {
  console.log(`Bot ready: ${client.user.tag}`);
});

client.login(process.env.TOKEN);
