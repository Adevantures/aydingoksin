const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
} = require('@discordjs/voice');
require('dotenv').config();
const ffmpegPath = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpegPath;


// --------------- BOT & PLAYER -----------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
const player = createAudioPlayer();

let queue = [];
let currentSongIndex = 0;
let resource = null;
// DÜZELTME 1: isSkipping bayrağı eklendi — Idle eventi skip/stop sonrası
// yanlışlıkla bir sonraki şarkıya geçmesin diye.
let isSkipping = false;

// --------------- ŞARKILAR -----------------
queue = [
  { title: "Doki Doki Literature Club!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/izzackus/1-01.%20Doki%20Doki%20Literature%20Club%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Ohayou Sayori!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fyaipyad/1-02.%20Ohayou%20Sayori%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Dreams of Love and Literature", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/sbdpmsbc/1-03.%20Dreams%20of%20Love%20and%20Literature.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Okay, Everyone!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/ktppgloj/1-04.%20Okay%2C%20Everyone%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Play with Me", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/eujlcftf/1-05.%20Play%20with%20Me.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Poem Panic!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/ruzlheyd/1-06.%20Poem%20Panic%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Daijobu!", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/yhpbooda/1-07.%20Daijoubu%21.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "My Feelings", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/rjtpwklc/1-08.%20My%20Feelings.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "My Confession", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/cdmxefkl/1-09.%20My%20Confession.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Sayo-Nara", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/auwxwtci/1-10.%20Sayo-Nara.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Just Monika", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/fefphqis/1-11.%20Just%20Monika..mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "I Still Love You", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/qyxphrlf/1-12.%20I%20Still%20Love%20You.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Your Reality", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/ugxsxhwk/1-13.%20Your%20Reality.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Poems Are Forever (feat. Shoji)", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/mccfteqo/1-14.%20Poems%20Are%20Forever%20%28feat.%20Shoji%29.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
  { title: "Doki Doki (feat. Nikki Kaelar)", url: "https://nu.vgmtreasurechest.com/soundtracks/doki-doki-literature-club-official-soundtrack/yyafzjts/1-15.%20Doki%20Doki%20%28feat.%20Nikki%20Kaelar%29.mp3", image: "https://i.imgur.com/YIo0QKZ.jpeg" },
];

// --------------- SES OLAYI -----------------
// DÜZELTME 2: Bağlantı yönetimi playSong dışına alındı.
// getVoiceConnection ile mevcut bağlantı kontrol ediliyor,
// yoksa yeni bağlantı kuruluyor. Her Idle'da bağlantı yeniden
// kurulmaya çalışılmıyacak.
function getOrJoinChannel(voiceChannel) {
  const existing = getVoiceConnection(voiceChannel.guild.id);
  if (existing) return existing;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  connection.subscribe(player);

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    currentSongIndex = 0;
    isSkipping = false;
    try { connection.destroy(); } catch (_) {}
  });

  return connection;
}

function playSong(voiceChannel) {
  const song = queue[currentSongIndex];
  resource = createAudioResource(song.url, { inlineVolume: true });
  resource.volume.setVolume(0.5);

  // DÜZELTME 3: player.once yerine player.on kullanılıyor ve
  // isSkipping bayrağıyla çift-atlama engelleniyor.
  // Ayrıca listener birikmesini önlemek için removeAllListeners kullanıldı.
  player.removeAllListeners(AudioPlayerStatus.Idle);
  player.once(AudioPlayerStatus.Idle, () => {
    if (isSkipping) {
      isSkipping = false;
      return;
    }
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    playSong(voiceChannel);
  });

  getOrJoinChannel(voiceChannel);
  player.play(resource);
}

// --------------- BOT EVENT -----------------
client.on('messageCreate', async (message) => {
  if (!message.guild || message.author.bot) return;
  const args = message.content.split(' ');
  const command = args.shift().toLowerCase();

  const voiceChannel = message.member.voice.channel;
  const musicCommands = ['!play', '!pause', '!resume', '!stop', '!skip'];
  if (!voiceChannel && musicCommands.includes(command)) {
    return message.reply('Bir ses kanalında olmalısın!');
  }

  // ---------------- COMMANDS -----------------
  if (command === '!play') {
    currentSongIndex = 0;
    isSkipping = false;
    playSong(voiceChannel);
    message.channel.send(`🎵 Oynatılıyor: **${queue[currentSongIndex].title}**`);
  }

  else if (command === '!pause') {
    if (player.state.status === AudioPlayerStatus.Playing) {
      player.pause();
      message.channel.send(`⏸️ Duraklatıldı: **${queue[currentSongIndex].title}**`);
    } else {
      message.reply('Şu an çalan bir şarkı yok.');
    }
  }

  // DÜZELTME 4: !resume artık player.unpause() kullanıyor.
  // createAudioResource'ta startTime diye bir seçenek yok,
  // eski kod resume'yi tamamen kırıyordu.
  else if (command === '!resume') {
    if (player.state.status === AudioPlayerStatus.Paused) {
      player.unpause();
      message.channel.send(`▶️ Devam ediyor: **${queue[currentSongIndex].title}**`);
    } else {
      message.reply('Duraklatılmış bir şarkı yok.');
    }
  }

  else if (command === '!stop') {
    isSkipping = true; // Idle eventi tetiklenmesin
    player.stop();
    currentSongIndex = 0;

    // Bağlantıyı da kapat
    const connection = getVoiceConnection(message.guild.id);
    if (connection) connection.destroy();

    message.channel.send('⏹️ Radyo durduruldu ve başa alındı.');
  }

  // DÜZELTME 5: !skip artık önce isSkipping=true yapıyor,
  // Idle eventi yanlışlıkla bir kez daha atlamıyor.
  // Mesaj da doğru (yeni) şarkı adıyla gönderiliyor.
  else if (command === '!skip') {
    isSkipping = true;
    player.stop();
    currentSongIndex = (currentSongIndex + 1) % queue.length;
    playSong(voiceChannel);
    message.channel.send(`⏭️ Geçildi → şimdi çalıyor: **${queue[currentSongIndex].title}**`);
  }

  else if (command === '!queue') {
    let desc = queue
      .map((s, i) =>
        i === currentSongIndex
          ? `**▶ ${s.title} (şu an çalıyor)**`
          : `${i + 1}. ${s.title}`
      )
      .join('\n');

    // DÜZELTME 6: Discord embed 4096 karakter limitini aşmamak için kırpma
    if (desc.length > 4096) desc = desc.slice(0, 4093) + '...';

    const embed = new EmbedBuilder()
      .setTitle('🎶 Şarkı Listesi')
      .setDescription(desc)
      .setColor('#CCEBFF');
    message.channel.send({ embeds: [embed] });
  }

  else if (command === '!nowplaying') {
    const song = queue[currentSongIndex];
    const embed = new EmbedBuilder()
      .setTitle('🎵 Şu An Çalıyor')
      .setDescription(song.title)
      .setThumbnail(song.image)
      .setColor('#CCEBFF');
    message.channel.send({ embeds: [embed] });
  }
});

client.once('clientReady', () => {
  console.log(`🎵 Music bot ready as ${client.user.tag}`);
});

client.login(process.env.TOKEN);