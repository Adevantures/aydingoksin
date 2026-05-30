const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
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
  {
    title: "Doki Doki Literature Club!",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/izzackus/1-01.%20Doki%20Doki%20Literature%20Club%21.mp3",
    image: "https://i.imgur.com/YIo0QKZ.jpeg",
  },
  {
    title: "Ohayou Sayori!",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fyaipyad/1-02.%20Ohayou%20Sayori%21.mp3",
    image: "https://i.imgur.com/YIo0QKZ.jpeg",
  },
  {
    title: "Dreams of Love and Literature",
    url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/sbdpmsbc/1-03.%20Dreams%20of%20Love%20and%20Literature.mp3",
    image: "https://i.imgur.com/YIo0QKZ.jpeg",
  },
];

let currentSongIndex = 0;
let connection = null;
let activeChannel = null;       // We track this ourselves — don't rely on voice state cache
let connectingPromise = null;   // Lock: prevents two simultaneous join attempts

async function getOrCreateConnection(channel) {
  // If a connection attempt is already in progress, wait for it
  if (connectingPromise) {
    console.log(`[VOICE] Connection already in progress — waiting for it...`);
    await connectingPromise;
    return getVoiceConnection(channel.guild.id);
  }

  const existing = getVoiceConnection(channel.guild.id);
  if (existing && existing.state.status === VoiceConnectionStatus.Ready) {
    console.log(`[VOICE] Reusing ready connection`);
    return existing;
  }

  if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
    console.log(`[VOICE] Waiting for existing connection (status: ${existing.state.status})...`);
    connectingPromise = entersState(existing, VoiceConnectionStatus.Ready, 15_000);
    await connectingPromise;
    connectingPromise = null;
    console.log(`[VOICE] Existing connection is now Ready`);
    return existing;
  }

  // No usable connection — create one
  console.log(`[VOICE] Joining channel: ${channel.name} in guild: ${channel.guild.name}`);
  activeChannel = channel;

  connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
  });

  connection.subscribe(player);
  console.log(`[VOICE] Player subscribed`);

  connection.on('error', (error) => {
    console.error(`[VOICE ERROR] ${error.message}`);
  });

  connection.on('stateChange', (oldState, newState) => {
    console.log(`[VOICE STATE] ${oldState.status} → ${newState.status}`);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    console.warn(`[VOICE] Disconnected — attempting reconnect...`);
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
      ]);
      console.log(`[VOICE] Reconnected`);
    } catch {
      console.error(`[VOICE] Reconnect failed — destroying`);
      connection.destroy();
      connection = null;
      connectingPromise = null;
    }
  });

  connectingPromise = entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  console.log(`[VOICE] Waiting for Ready...`);
  await connectingPromise;
  connectingPromise = null;
  console.log(`[VOICE] Connection Ready`);

  return connection;
}

async function playSong(channel) {
  const song = queue[currentSongIndex];
  console.log(`[PLAYER] Queuing [${currentSongIndex}]: "${song.title}"`);

  try {
    await getOrCreateConnection(channel);
  } catch (err) {
    console.error(`[PLAYER] Connection failed: ${err.message}`);
    connectingPromise = null;
    return;
  }

  console.log(`[PLAYER] Creating resource and playing...`);
  const resource = createAudioResource(song.url, {
    inputType: StreamType.Arbitrary,
  });
  player.play(resource);
  console.log(`[PLAYER] player.play() called — status: ${player.state.status}`);
}

player.on('stateChange', (oldState, newState) => {
  console.log(`[PLAYER STATE] ${oldState.status} → ${newState.status}`);
});

player.on(AudioPlayerStatus.Playing, () => {
  console.log(`[PLAYER] ✅ Now playing: "${queue[currentSongIndex].title}"`);
});

player.on(AudioPlayerStatus.Buffering, () => {
  console.log(`[PLAYER] Buffering...`);
});

player.on(AudioPlayerStatus.Idle, () => {
  console.log(`[PLAYER] Track finished — advancing...`);
  currentSongIndex = (currentSongIndex + 1) % queue.length;

  if (!activeChannel) {
    console.warn(`[PLAYER] No active channel tracked — cannot auto-advance`);
    return;
  }

  console.log(`[PLAYER] Auto-advancing to [${currentSongIndex}]: "${queue[currentSongIndex].title}"`);
  playSong(activeChannel);
});

player.on('error', (error) => {
  console.error(`[PLAYER ERROR] ${error.message}`);
});

client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const voiceChannel = message.member.voice.channel;

  console.log(`[CMD] "${command}" from ${message.author.tag}`);

  if (['!play', '!skip', '!stop'].includes(command) && !voiceChannel) {
    return message.reply('Bir ses kanalında olmalısın!');
  }

  if (command === '!play') {
    currentSongIndex = 0;
    activeChannel = voiceChannel;
    await playSong(voiceChannel);
    message.channel.send(`🎵 Çalıyor: **${queue[currentSongIndex].title}**`);
  }

  if (command === '!skip') {
    const prev = currentSongIndex;
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    console.log(`[CMD] skip ${prev} → ${currentSongIndex}: "${queue[currentSongIndex].title}"`);
    activeChannel = voiceChannel;
    await playSong(voiceChannel);
    message.channel.send(`⏭️ Skip → **${queue[currentSongIndex].title}**`);
  }

  if (command === '!stop') {
    player.stop();
    const conn = getVoiceConnection(message.guild.id);
    if (conn) conn.destroy();
    connection = null;
    connectingPromise = null;
    activeChannel = null;
    console.log(`[VOICE] Stopped and cleaned up`);
    message.channel.send('⏹️ Durduruldu');
  }

  if (command === '!queue') {
    const list = queue
      .map((s, i) => (i === currentSongIndex ? `▶ ${s.title}` : `${i + 1}. ${s.title}`))
      .join('\n');
    const embed = new EmbedBuilder()
      .setTitle('🎶 Queue')
      .setDescription(list)
      .setColor('#CCEBFF');
    message.channel.send({ embeds: [embed] });
  }

  if (command === '!debug') {
    const conn = getVoiceConnection(message.guild.id);
    const info = [
      `**Player:** ${player.state.status}`,
      `**Connection:** ${conn?.state.status ?? 'none'}`,
      `**Connecting lock:** ${connectingPromise ? 'yes' : 'no'}`,
      `**Song [${currentSongIndex}]:** ${queue[currentSongIndex].title}`,
      `**Active channel:** ${activeChannel?.name ?? 'none'}`,
    ].join('\n');
    message.channel.send(info);
  }
});

client.once('clientReady', () => {
  console.log(`[BOT] Ready: ${client.user.tag}`);
  console.log(`[BOT] Serving ${client.guilds.cache.size} guild(s)`);
});

client.login(process.env.TOKEN);
