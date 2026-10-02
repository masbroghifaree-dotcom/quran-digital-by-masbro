const API_BASE = 'https://equran.id/api/v2';

const state = {
  suratList: [],
  selectedSuratNomor: null,
  selectedSuratData: null,
  mentorMode: 'tebak',
  score: 0,
  currentQuestion: null,
  answered: false,
  audioPlayer: null,
};

const elements = {
  navButtons: document.querySelectorAll('.nav-button'),
  panels: document.querySelectorAll('.panel'),
  loadingStatus: document.getElementById('loadingStatus'),
  errorStatus: document.getElementById('errorStatus'),
  suratList: document.getElementById('suratList'),
  suratDetail: document.getElementById('suratDetail'),
  scoreValue: document.getElementById('scoreValue'),
  mentorMessage: document.getElementById('mentorMessage'),
  quizPrompt: document.getElementById('quizPrompt'),
  answerButtons: document.getElementById('answerButtons'),
  feedbackBox: document.getElementById('feedbackBox'),
  nextQuestionButton: document.getElementById('nextQuestionButton'),
  startAgainButton: document.getElementById('startAgainButton'),
  modeButtons: document.querySelectorAll('.mode-button'),
};

function showStatus(type, message) {
  const target = type === 'error' ? elements.errorStatus : elements.loadingStatus;
  target.textContent = message;
  target.classList.add('visible');

  if (type === 'error') {
    elements.loadingStatus.classList.remove('visible');
  } else {
    elements.errorStatus.classList.remove('visible');
  }
}

function hideStatus(type) {
  const target = type === 'error' ? elements.errorStatus : elements.loadingStatus;
  target.textContent = '';
  target.classList.remove('visible');
}

function setActiveTab(tabName) {
  elements.navButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  elements.panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === `${tabName}-panel`);
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Permintaan gagal. Kode status: ${response.status}`);
  }

  return response.json();
}

function renderSuratList() {
  elements.suratList.innerHTML = '';

  state.suratList.forEach((surat) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'surat-item';
    button.dataset.nomor = surat.nomor;
    button.innerHTML = `
      <strong>${surat.nomor}. ${surat.namaLatin}</strong>
      <small>${surat.jumlahAyat} ayat • ${surat.tempatTurun}</small>
    `;

    if (String(state.selectedSuratNomor) === String(surat.nomor)) {
      button.classList.add('active');
    }

    button.addEventListener('click', () => {
      loadSuratDetail(surat.nomor);
    });

    elements.suratList.appendChild(button);
  });
}

function renderSuratDetail() {
  if (!state.selectedSuratData) {
    elements.suratDetail.innerHTML = '<p>Silakan pilih surat.</p>';
    return;
  }

  const surat = state.selectedSuratData;
  const ayatList = surat.ayat ?? [];
  const audioEntries = Object.entries(surat.audioFull || {});

  const header = `
    <div class="surat-header">
      <h3>${surat.namaLatin} (${surat.nama})</h3>
      <div class="meta">
        <span>Nomor: ${surat.nomor}</span>
        <span>Ayat: ${surat.jumlahAyat}</span>
        <span>Tempat turun: ${surat.tempatTurun}</span>
      </div>
    </div>
  `;

  const audioMarkup = audioEntries.length
    ? `
      <div class="audio-player">
        <label for="suratAudioSelect">Audio surat</label>
        <div class="audio-controls">
          <select id="suratAudioSelect" class="audio-select">
            ${audioEntries
              .map(
                ([key, url]) => `
                  <option value="${url}">${key}</option>
                `
              )
              .join('')}
          </select>
          <button type="button" class="primary-button" data-action="play-surat">Putar Surat</button>
        </div>
      </div>
    `
    : '<p class="translation">Audio surat tidak tersedia untuk saat ini.</p>';

  const detailMarkup = ayatList
    .map(
      (ayat) => `
        <article class="verse-item">
          <div class="verse-number">${ayat.nomorAyat}</div>
          <div class="verse-arab">${ayat.teksArab || ''}</div>
          <p class="translation">${ayat.teksIndonesia || 'Terjemahan tidak tersedia.'}</p>
        </article>
      `
    )
    .join('');

  elements.suratDetail.innerHTML = `
    ${header}
    ${audioMarkup}
    <div class="verse-list">${detailMarkup}</div>
  `;

  const playButton = elements.suratDetail.querySelector('[data-action="play-surat"]');
  const select = elements.suratDetail.querySelector('#suratAudioSelect');

  if (playButton && select) {
    playButton.addEventListener('click', () => {
      const selectedUrl = select.value;
      if (!selectedUrl) {
        return;
      }

      if (state.audioPlayer && !state.audioPlayer.paused && state.audioPlayer.src === selectedUrl) {
        state.audioPlayer.pause();
        state.audioPlayer.currentTime = 0;
        state.audioPlayer = null;
        playButton.textContent = 'Putar Surat';
        return;
      }

      if (state.audioPlayer) {
        state.audioPlayer.pause();
        state.audioPlayer.currentTime = 0;
      }

      const audio = new Audio(selectedUrl);
      state.audioPlayer = audio;
      audio.play().catch((error) => {
        console.error('Gagal memutar audio surat:', error);
      });

      playButton.textContent = 'Jeda';
      audio.onended = () => {
        state.audioPlayer = null;
        playButton.textContent = 'Putar Surat';
      };
      audio.onpause = () => {
        if (!audio.ended) {
          playButton.textContent = 'Putar Surat';
        }
      };
    });
  }
}

async function loadSuratList() {
  showStatus('loading', 'Memuat daftar surat...');
  elements.errorStatus.classList.remove('visible');

  try {
    const result = await fetchJson(`${API_BASE}/surat`);
    state.suratList = result.data || [];

    if (state.suratList.length > 0) {
      const firstSurat = state.suratList[0];
      state.selectedSuratNomor = firstSurat.nomor;
      await loadSuratDetail(firstSurat.nomor);
    }

    renderSuratList();
    hideStatus('loading');
  } catch (error) {
    console.error(error);
    showStatus('error', 'Gagal memuat daftar surat. Periksa koneksi internet atau API equran.id.');
  }
}

async function loadSuratDetail(nomor) {
  showStatus('loading', 'Memuat surat yang dipilih...');
  elements.errorStatus.classList.remove('visible');

  try {
    const result = await fetchJson(`${API_BASE}/surat/${nomor}`);
    state.selectedSuratNomor = nomor;
    state.selectedSuratData = result.data || null;
    renderSuratList();
    renderSuratDetail();
    hideStatus('loading');
    resetMentorRound();
  } catch (error) {
    console.error(error);
    showStatus('error', 'Gagal memuat detail surat. API mungkin sedang tidak tersedia.');
  }
}

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function getRandomUniqueIndexes(total, excludeSet = [], count = 2) {
  const pool = [];
  for (let i = 0; i < total; i += 1) {
    if (!excludeSet.includes(i)) {
      pool.push(i);
    }
  }

  const shuffled = shuffleArray(pool);
  return shuffled.slice(0, count);
}

function buildQuestion(mode) {
  const ayat = state.selectedSuratData?.ayat ?? [];
  if (!state.selectedSuratData || ayat.length < 4) {
    elements.mentorMessage.textContent = 'Jumlah ayat di surat ini terlalu sedikit. Pilih surat lain dengan minimal 4 ayat agar soal tidak ambigu.';
    elements.quizPrompt.textContent = '';
    elements.answerButtons.innerHTML = '';
    elements.feedbackBox.textContent = '';
    elements.nextQuestionButton.classList.add('hidden');
    return null;
  }

  if (mode === 'tebak') {
    const correctIndex = Math.floor(Math.random() * ayat.length);
    const correctNumber = ayat[correctIndex].nomorAyat;
    const distractorIndexes = getRandomUniqueIndexes(ayat.length, [correctIndex], 2);
    const distractorNumbers = distractorIndexes.map((index) => ayat[index].nomorAyat);
    const options = shuffleArray([correctNumber, ...distractorNumbers]);

    return {
      mode,
      promptText: ayat[correctIndex].teksArab,
      correctAnswer: correctNumber,
      options,
      label: 'Tebak nomor ayat berikut ini:',
    };
  }

  const correctIndex = Math.floor(Math.random() * (ayat.length - 1));
  const correctText = ayat[correctIndex + 1].teksArab;
  const distractorIndexes = getRandomUniqueIndexes(ayat.length, [correctIndex + 1], 2);
  const distractorTexts = distractorIndexes
    .map((index) => ayat[index].teksArab)
    .filter((text, index, arr) => text && arr.indexOf(text) === index)
    .slice(0, 2);

  if (distractorTexts.length < 2) {
    elements.mentorMessage.textContent = 'Pilihan jawaban tidak cukup unik untuk mode Sambung Ayat. Coba surat lain.';
    elements.quizPrompt.textContent = '';
    elements.answerButtons.innerHTML = '';
    elements.feedbackBox.textContent = '';
    elements.nextQuestionButton.classList.add('hidden');
    return null;
  }

  return {
    mode,
    promptText: ayat[correctIndex].teksArab,
    correctAnswer: correctText,
    options: shuffleArray([correctText, ...distractorTexts]),
    label: 'Sambung ayat berikut ini:',
  };
}

function renderQuestion() {
  const question = buildQuestion(state.mentorMode);
  if (!question) {
    return;
  }

  state.currentQuestion = question;
  state.answered = false;
  elements.feedbackBox.textContent = '';
  elements.feedbackBox.className = 'feedback-box';
  elements.nextQuestionButton.classList.add('hidden');

  elements.quizPrompt.innerHTML = `
    <strong>${question.label}</strong><br>
    <span class="verse-arab" style="display:block; margin-top: 12px;">${question.promptText}</span>
  `;

  elements.answerButtons.innerHTML = '';
  question.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-button';
    button.textContent = question.mode === 'tebak' ? `Nomor ${option}` : option;
    button.dataset.value = String(option);
    button.addEventListener('click', () => handleAnswer(option, button));
    elements.answerButtons.appendChild(button);
  });

  elements.mentorMessage.textContent = `Surat dipilih: ${state.selectedSuratData.namaLatin} (${state.selectedSuratData.nama})`;
}

function handleAnswer(selectedOption, buttonElement) {
  if (state.answered || !state.currentQuestion) {
    return;
  }

  state.answered = true;
  const isCorrect = selectedOption === state.currentQuestion.correctAnswer;
  const buttons = [...elements.answerButtons.querySelectorAll('.answer-button')];

  buttons.forEach((button) => {
    button.disabled = true;
    const isOptionCorrect = button.dataset.value === String(state.currentQuestion.correctAnswer);
    if (isOptionCorrect) {
      button.classList.add('correct');
    }
    if (button === buttonElement && !isCorrect) {
      button.classList.add('wrong');
    }
  });

  if (isCorrect) {
    state.score += 10;
    elements.scoreValue.textContent = String(state.score);
    elements.feedbackBox.textContent = 'Benar! +10 poin.';
    elements.feedbackBox.classList.add('success');
  } else {
    elements.feedbackBox.textContent = `Salah. Jawaban yang benar adalah ${state.currentQuestion.mode === 'tebak' ? `Nomor ${state.currentQuestion.correctAnswer}` : state.currentQuestion.correctAnswer}.`;
    elements.feedbackBox.classList.add('error');
  }

  elements.nextQuestionButton.classList.remove('hidden');
}

function resetMentorRound() {
  state.score = 0;
  elements.scoreValue.textContent = '0';
  elements.feedbackBox.textContent = '';
  elements.feedbackBox.className = 'feedback-box';
  elements.nextQuestionButton.classList.add('hidden');
  elements.mentorMessage.textContent = 'Pilih mode dan mulai latihan.';
  elements.quizPrompt.textContent = '';
  elements.answerButtons.innerHTML = '';
  if (state.selectedSuratData && state.selectedSuratData.ayat.length >= 4) {
    renderQuestion();
  }
}

function setMentorMode(mode) {
  state.mentorMode = mode;
  elements.modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  resetMentorRound();
}

function attachEvents() {
  elements.navButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  elements.modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setMentorMode(button.dataset.mode);
    });
  });

  elements.nextQuestionButton.addEventListener('click', () => {
    if (!state.selectedSuratData) {
      elements.mentorMessage.textContent = 'Pilih surat terlebih dahulu di menu Al-Qur’an.';
      return;
    }
    renderQuestion();
  });

  elements.startAgainButton.addEventListener('click', () => {
    state.score = 0;
    elements.scoreValue.textContent = '0';
    if (state.selectedSuratData) {
      renderQuestion();
    } else {
      elements.mentorMessage.textContent = 'Pilih surat di menu Al-Qur’an sebelum memulai.';
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  attachEvents();
  setActiveTab('quran');
  loadSuratList();
});
