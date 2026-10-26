import { useState, useEffect, useCallback } from 'react';
import { chapters, getMaxScore, TimelineEvent } from './gameData';

type GameState = 'start' | 'playing' | 'result';
type FeedbackState = { show: boolean; text: string; correct: boolean };

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function downloadHTML() {
  const link = document.createElement('a');
  link.href = '/game.html';
  link.download = 'Хроники_Европы_1922-1939.html';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function App() {
  const [gameState, setGameState] = useState<GameState>('start');
  const [currentChapter, setCurrentChapter] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>({ show: false, text: '', correct: false });
  const [timelineOrder, setTimelineOrder] = useState<string[]>([]);
  const [termMatches, setTermMatches] = useState<Record<string, string>>({});
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [showChapterIntro, setShowChapterIntro] = useState(true);
  const [fadeIn, setFadeIn] = useState(true);
  const [shuffledChoices, setShuffledChoices] = useState<any[]>([]);
  const [shuffledTimeline, setShuffledTimeline] = useState<any[]>([]);
  const [shuffledDefs, setShuffledDefs] = useState<any[]>([]);
  const [trueFalseAnswers, setTrueFalseAnswers] = useState<Record<number, boolean | null>>({});
  const [trueFalseChecked, setTrueFalseChecked] = useState(false);
  const [fillBlankAnswers, setFillBlankAnswers] = useState<string[]>([]);
  const [fillBlankChecked, setFillBlankChecked] = useState(false);
  const [multiSelected, setMultiSelected] = useState<Set<number>>(new Set());
  const [multiChecked, setMultiChecked] = useState(false);
  const [docAnswers, setDocAnswers] = useState<(number | null)[]>([]);
  const [docShuffled, setDocShuffled] = useState<any[][]>([]);

  const chapter = chapters[currentChapter];

  useEffect(() => {
    if (!chapter) return;
    setShowChapterIntro(true);
    setFeedback({ show: false, text: '', correct: false });
    setTrueFalseAnswers({});
    setTrueFalseChecked(false);
    setFillBlankChecked(false);
    setMultiSelected(new Set());
    setMultiChecked(false);
    setDocAnswers([]);

    if (chapter.type === 'choice') {
      setShuffledChoices(shuffleArray(chapter.data.choices));
    } else if (chapter.type === 'document') {
      const shuffled = chapter.data.questions.map((q: any) => shuffleArray(q.choices));
      setDocShuffled(shuffled);
      setDocAnswers(new Array(chapter.data.questions.length).fill(null));
    }

    if (chapter.type === 'timeline') {
      setShuffledTimeline(shuffleArray(chapter.data.events));
      setTimelineOrder(shuffleArray(chapter.data.events).map((e: any) => e.id));
    }

    if (chapter.type === 'terms') {
      setShuffledDefs(shuffleArray(chapter.data.terms));
      setTermMatches({});
      setSelectedTerm(null);
    }

    if (chapter.type === 'truefalse') {
      setTrueFalseAnswers({});
      setTrueFalseChecked(false);
    }

    if (chapter.type === 'fillblank') {
      setFillBlankAnswers(new Array(chapter.data.items.length).fill(''));
      setFillBlankChecked(false);
    }

    if (chapter.type === 'multi') {
      setShuffledChoices(shuffleArray(chapter.data.choices));
      setMultiSelected(new Set());
      setMultiChecked(false);
    }
  }, [currentChapter, chapter]);

  const transitionTo = useCallback((action: () => void) => {
    setFadeIn(false);
    setTimeout(() => {
      action();
      setFadeIn(true);
    }, 300);
  }, []);

  const handleChoice = (originalIndex: number) => {
    if (feedback.show) return;
    const choice = shuffledChoices[originalIndex];
    setFeedback({ show: true, text: choice.feedback, correct: choice.correct });
    if (choice.correct) {
      setScore(prev => prev + (choice.points || 10));
    }
  };

  const handleTimelineCheck = () => {
    const events = chapter.data.events as TimelineEvent[];
    const correctOrder = [...events].sort((a, b) => a.year - b.year).map(e => e.id);
    const isCorrect = JSON.stringify(timelineOrder) === JSON.stringify(correctOrder);
    
    if (isCorrect) {
      setFeedback({ show: true, text: 'Отлично! Хронология абсолютно верна!', correct: true });
      setScore(prev => prev + 10);
    } else {
      const correctText = correctOrder.map((id, i) => {
        const ev = events.find(e => e.id === id);
        return `${i + 1}. ${ev?.year} — ${ev?.text}`;
      }).join('\n');
      setFeedback({ show: true, text: `Не совсем верно. Правильный порядок:\n${correctText}`, correct: false });
    }
  };

  const moveTimelineItem = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...timelineOrder];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newOrder.length) return;
    [newOrder[index], newOrder[swapIndex]] = [newOrder[swapIndex], newOrder[index]];
    setTimelineOrder(newOrder);
  };

  const handleTermSelect = (term: string) => {
    if (feedback.show) return;
    setSelectedTerm(term);
  };

  const handleTermMatch = (definition: string) => {
    if (!selectedTerm || feedback.show) return;
    const newMatches = { ...termMatches, [selectedTerm]: definition };
    setTermMatches(newMatches);
    setSelectedTerm(null);
    
    const totalTerms = chapter.data.terms.length;
    if (Object.keys(newMatches).length === totalTerms) {
      const correctCount = Object.entries(newMatches).filter(([term, def]) => {
        const correct = chapter.data.terms.find((t: any) => t.term === term);
        return correct && correct.definition === def;
      }).length;
      
      const points = Math.round((correctCount / totalTerms) * 10);
      setScore(prev => prev + points);
      
      if (correctCount === totalTerms) {
        setFeedback({ show: true, text: `Превосходно! Все ${totalTerms} терминов соединены верно!`, correct: true });
      } else {
        setFeedback({ 
          show: true, 
          text: `Верно соединено: ${correctCount} из ${totalTerms}.\n\nПравильные ответы:\n${chapter.data.terms.map((t: any) => `• ${t.term} — ${t.definition}`).join('\n')}`, 
          correct: correctCount >= 3 
        });
      }
    }
  };

  const handleTrueFalse = (index: number, answer: boolean) => {
    if (trueFalseChecked) return;
    setTrueFalseAnswers(prev => ({ ...prev, [index]: answer }));
  };

  const handleTrueFalseCheck = () => {
    setTrueFalseChecked(true);
    const items = chapter.data.items;
    let correct = 0;
    items.forEach((item: any, i: number) => {
      if (trueFalseAnswers[i] === item.isTrue) correct++;
    });
    const points = Math.round((correct / items.length) * 10);
    setScore(prev => prev + points);
    if (correct === items.length) {
      setFeedback({ show: true, text: `Безупречно! Все ${items.length} утверждений оценены верно!`, correct: true });
    } else {
      setFeedback({ show: true, text: `Верно: ${correct} из ${items.length}. Читайте объяснения к каждому утверждению.`, correct: correct >= items.length / 2 });
    }
  };

  const handleFillBlankCheck = () => {
    setFillBlankChecked(true);
    const items = chapter.data.items;
    let correct = 0;
    items.forEach((item: any, i: number) => {
      const userAnswer = (fillBlankAnswers[i] || '').trim().toLowerCase();
      if (item.blanks.some((b: string) => b.toLowerCase() === userAnswer)) correct++;
    });
    const points = Math.round((correct / items.length) * 10);
    setScore(prev => prev + points);
    if (correct === items.length) {
      setFeedback({ show: true, text: `Отлично! Все ${items.length} пропусков заполнены верно!`, correct: true });
    } else {
      setFeedback({ 
        show: true, 
        text: `Верно: ${correct} из ${items.length}.\n\nПравильные ответы:\n${items.map((item: any) => `• ${item.blanks[0].toUpperCase()}`).join(', ')}`, 
        correct: correct >= 2 
      });
    }
  };

  const handleMultiToggle = (index: number) => {
    if (multiChecked) return;
    const newSelected = new Set(multiSelected);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setMultiSelected(newSelected);
  };

  const handleMultiCheck = () => {
    setMultiChecked(true);
    const choices = shuffledChoices;
    const correctIndices = new Set<number>();
    choices.forEach((c: any, i: number) => { if (c.correct) correctIndices.add(i); });
    
    let correctSelections = 0;
    let wrongSelections = 0;
    multiSelected.forEach(i => {
      if (correctIndices.has(i)) correctSelections++;
      else wrongSelections++;
    });
    
    const missed = correctIndices.size - correctSelections;
    const totalCorrect = correctIndices.size;
    const accuracy = Math.max(0, (correctSelections - wrongSelections) / totalCorrect);
    const points = Math.round(accuracy * 10);
    setScore(prev => prev + points);
    
    const feedbackText = choices.map((c: any, i: number) => {
      const wasSelected = multiSelected.has(i);
      const isCorrect = c.correct;
      if (wasSelected && isCorrect) return `✓ ${c.text}`;
      if (!wasSelected && isCorrect) return `⊘ ${c.text} (пропущено)`;
      if (wasSelected && !isCorrect) return `✗ ${c.text} (лишнее)`;
      return `  ${c.text}`;
    }).join('\n');
    
    if (wrongSelections === 0 && missed === 0) {
      setFeedback({ show: true, text: `Безупречно! Все верные утверждения выбраны!\n\n${feedbackText}`, correct: true });
    } else {
      setFeedback({ show: true, text: `Результат:\n${feedbackText}`, correct: accuracy >= 0.7 });
    }
  };

  const handleDocAnswer = (questionIdx: number, choiceIdx: number) => {
    if (docAnswers[questionIdx] !== null && docAnswers[questionIdx] !== undefined) return;
    const newAnswers = [...docAnswers];
    newAnswers[questionIdx] = choiceIdx;
    setDocAnswers(newAnswers);
  };

  const handleDocCheck = () => {
    const questions = chapter.data.questions;
    let correct = 0;
    questions.forEach((q: any, qi: number) => {
      const answerIdx = docAnswers[qi];
      if (answerIdx !== null && answerIdx !== undefined) {
        const selectedChoice = docShuffled[qi][answerIdx];
        if (selectedChoice && selectedChoice.correct) correct++;
      }
    });
    const points = Math.round((correct / questions.length) * 10);
    setScore(prev => prev + points);
    
    const feedbackText = questions.map((q: any, qi: number) => {
      const answerIdx = docAnswers[qi];
      const selectedChoice = (answerIdx !== null && answerIdx !== undefined) ? docShuffled[qi][answerIdx] : null;
      const correctChoice = docShuffled[qi].find((c: any) => c.correct);
      return `Вопрос ${qi + 1}: ${selectedChoice?.feedback || correctChoice?.feedback}`;
    }).join('\n\n');
    
    setFeedback({ show: true, text: feedbackText, correct: correct === questions.length });
  };

  const nextChapter = () => {
    if (currentChapter < chapters.length - 1) {
      transitionTo(() => {
        setCurrentChapter(prev => prev + 1);
      });
    } else {
      transitionTo(() => {
        setGameState('result');
      });
    }
  };

  const startGame = () => {
    transitionTo(() => {
      setGameState('playing');
      setCurrentChapter(0);
      setScore(0);
    });
  };

  const restartGame = () => {
    transitionTo(() => {
      setGameState('start');
      setCurrentChapter(0);
      setScore(0);
    });
  };

  const getRank = () => {
    const percent = (score / getMaxScore()) * 100;
    if (percent >= 90) return { 
      title: 'Пулитцеровский лауреат', 
      emoji: '🏆', 
      desc: 'Блестящее расследование! Ваши публикации стали мировым достоянием.',
      quote: '«Знание истории — лучший щит против повторения ошибок»',
      color: 'from-amber-500 to-yellow-400'
    };
    if (percent >= 75) return { 
      title: 'Главный редактор', 
      emoji: '📰', 
      desc: 'Превосходная работа! Вы глубоко разобрались в теме.',
      quote: '«Свобода печати — основа демократического общества»',
      color: 'from-amber-600 to-amber-400'
    };
    if (percent >= 60) return { 
      title: 'Старший корреспондент', 
      emoji: '✒️', 
      desc: 'Хорошая работа! Вы понимаете основные процессы эпохи.',
      quote: '«История учит, что она ничему не учит... пока мы не начинаем слушать»',
      color: 'from-amber-700 to-amber-500'
    };
    if (percent >= 45) return { 
      title: 'Корреспондент', 
      emoji: '📝', 
      desc: 'Неплохое начало! Но стоит углубить знания.',
      quote: '«Каждый эксперт когда-то был новичком»',
      color: 'from-orange-700 to-amber-600'
    };
    return { 
      title: 'Стажёр-исследователь', 
      emoji: '🔍', 
      desc: 'Рекомендуем перечитать материалы и попробовать снова.',
      quote: '«Путь к истине начинается с признания незнания»',
      color: 'from-orange-800 to-orange-600'
    };
  };

  if (gameState === 'start') {
    return (
      <div className={`min-h-screen min-h-[100dvh] bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center p-4 transition-opacity duration-700 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-2xl w-full text-center">
          <div className="mb-6 animate-float">
            <div className="inline-block p-5 rounded-full bg-amber-900/30 border border-amber-700/50 mb-4 animate-pulse-glow">
              <span className="text-5xl">📰</span>
            </div>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-amber-100 mb-2 tracking-tight text-shadow-amber" style={{ fontFamily: "'Playfair Display', serif" }}>
            Хроники Европы
          </h1>
          <p className="text-2xl md:text-3xl text-amber-400/80 mb-1 font-display" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>1922 — 1939</p>
          <div className="flex items-center justify-center gap-3 my-6">
            <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-600"></div>
            <span className="text-amber-600 text-sm tracking-widest uppercase">Интерактивная игра</span>
            <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-600"></div>
          </div>
          <p className="text-gray-300 text-lg mb-8 leading-relaxed max-w-lg mx-auto">
            <span className="text-amber-200 font-semibold italic" style={{ fontFamily: "'Playfair Display', serif" }}>
              «Итальянский фашизм. Авторитарные режимы в Европе»
            </span>
          </p>
          <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-6 mb-8 border border-amber-900/50 card-hover">
            <p className="text-gray-300 leading-relaxed text-left">
              <span className="text-amber-300 font-bold">Ваша роль:</span> Молодой журналист парижской газеты «Le Monde». 
              Вы путешествуете по Европе 1920–1930-х годов, расследуете рост авторитарных режимов и готовите серию публикаций.
            </p>
            <div className="mt-5 grid grid-cols-4 gap-2">
              {[
                { flag: '🇮🇹', name: 'Италия' },
                { flag: '🇩🇪', name: 'Германия' },
                { flag: '🇪🇸', name: 'Испания' },
                { flag: '🇵🇹', name: 'Португалия' }
              ].map(c => (
                <div key={c.name} className="bg-gray-700/50 rounded-xl p-3 text-center border border-gray-800/50 hover:border-amber-700/50 transition-all">
                  <span className="text-2xl">{c.flag}</span>
                  <p className="text-gray-400 text-xs mt-1">{c.name}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800/50 flex flex-wrap justify-center gap-2 text-xs text-gray-500">
              <span className="bg-gray-800/50 px-2 py-1 rounded">🔀 Перемешанные ответы</span>
              <span className="bg-gray-800/50 px-2 py-1 rounded">📝 7 типов заданий</span>
              <span className="bg-gray-800/50 px-2 py-1 rounded">📖 Сюжетная линия</span>
            </div>
          </div>
          <button
            onClick={startGame}
            className="bg-amber-700 hover:bg-amber-600 text-white font-bold py-4 px-12 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-amber-900/50 w-full sm:w-auto"
          >
            Начать расследование
          </button>
          <button
            onClick={downloadHTML}
            className="mt-3 bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold py-3 px-8 rounded-xl text-sm transition-all duration-300 border border-amber-900/50 w-full sm:w-auto"
          >
            💾 Скачать HTML версию (для офлайн)
          </button>
          <p className="text-gray-600 text-xs mt-6">Для учащихся 10 класса • Всеобщая история • Новейшее время</p>
        </div>
      </div>
    );
  }

  if (gameState === 'result') {
    const rank = getRank();
    const percent = Math.round((score / getMaxScore()) * 100);
    return (
      <div className={`min-h-screen min-h-[100dvh] bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 flex items-center justify-center p-4 transition-opacity duration-700 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-2xl w-full text-center">
          <div className="mb-6 animate-float">
            <div className="inline-block p-6 rounded-full bg-amber-900/30 border border-amber-700/50 animate-pulse-glow">
              <span className="text-7xl">{rank.emoji}</span>
            </div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-amber-100 mb-2 text-shadow-amber" style={{ fontFamily: "'Playfair Display', serif" }}>
            Расследование завершено!
          </h2>
          <p className="text-xl text-amber-300/80 mb-1 font-display" style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 600 }}>
            Ваша должность
          </p>
          <p className="text-2xl text-amber-200 font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
            {rank.title}
          </p>
          
          <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-6 sm:p-8 mb-6 border border-amber-900/50 card-hover">
            <div className="text-5xl sm:text-6xl font-bold text-amber-200 mb-2 text-shadow-amber" style={{ fontFamily: "'Playfair Display', serif" }}>{score}</div>
            <p className="text-gray-400 text-sm mb-4">из {getMaxScore()} возможных баллов</p>
            <div className="w-full bg-gray-700 rounded-full h-3 mb-4 overflow-hidden">
              <div 
                className={`bg-gradient-to-r ${rank.color} h-3 rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${percent}%` }}
              ></div>
            </div>
            <p className="text-gray-300 text-sm mb-4">{rank.desc}</p>
            <p className="text-amber-400/70 italic text-sm" style={{ fontFamily: "'Cormorant Garamond', serif" }}>{rank.quote}</p>
          </div>

          <div className="bg-gray-800/60 backdrop-blur rounded-2xl p-6 mb-8 border border-amber-900/50 text-left card-hover">
            <h3 className="text-amber-300 font-bold mb-4 text-center text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
              📚 Ключевые выводы
            </h3>
            <ul className="text-gray-300 space-y-3 text-sm">
              <li className="flex gap-2"><span className="text-amber-500">▸</span> Фашизм возник как реакция на кризис демократии после Первой мировой войны</li>
              <li className="flex gap-2"><span className="text-amber-500">▸</span> Муссолини создал первый фашистский режим (1922), ставший моделью для других</li>
              <li className="flex gap-2"><span className="text-amber-500">▸</span> Авторитарные и тоталитарные режимы — разные формы несвободы</li>
              <li className="flex gap-2"><span className="text-amber-500">▸</span> Пропаганда, культ личности и террор — инструменты удержания власти</li>
              <li className="flex gap-2"><span className="text-amber-500">▸</span> Защита демократических институтов — задача каждого поколения</li>
            </ul>
          </div>

          <button
            onClick={restartGame}
            className="bg-amber-700 hover:bg-amber-600 text-white font-bold py-4 px-12 rounded-xl text-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-amber-900/50 w-full sm:w-auto"
          >
            Пройти заново
          </button>
          <button
            onClick={downloadHTML}
            className="mt-3 bg-gray-800 hover:bg-gray-700 text-amber-300 font-semibold py-3 px-8 rounded-xl text-sm transition-all duration-300 border border-amber-900/50 w-full sm:w-auto"
          >
            💾 Скачать HTML версию (для офлайн)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen min-h-[100dvh] bg-gradient-to-br from-gray-900 via-red-950 to-gray-900 p-3 sm:p-4 md:p-6 transition-opacity duration-300 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-900/30 border border-amber-700/50 flex items-center justify-center">
              <span className="text-lg">📰</span>
            </div>
            <div>
              <p className="text-amber-300 text-sm font-semibold tracking-wide">Хроники Европы</p>
              <p className="text-gray-500 text-xs">Глава {currentChapter + 1} из {chapters.length}</p>
            </div>
          </div>
          <div className="bg-gray-800/80 backdrop-blur rounded-xl px-4 py-2 border border-amber-900/50">
            <p className="text-amber-200 text-sm font-bold">⭐ {score} <span className="text-gray-500 font-normal">/ {getMaxScore()}</span></p>
          </div>
        </div>

        <div className="w-full bg-gray-800/50 rounded-full h-1.5 mb-6 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-amber-600 to-amber-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${((currentChapter + 1) / chapters.length) * 100}%` }}
          ></div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur rounded-2xl border border-amber-900/50 overflow-hidden card-hover">
          <div className="bg-gradient-to-r from-red-900/80 to-amber-900/80 p-4 border-b border-amber-900/50">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-amber-100 font-serif">{chapter.title}</h2>
                <p className="text-amber-300/70 text-sm">{chapter.location} • {chapter.year}</p>
              </div>
              <span className="text-3xl">
                {currentChapter === 0 && '🗼'}
                {currentChapter === 1 && '🏛️'}
                {currentChapter === 2 && '📜'}
                {currentChapter === 3 && '📖'}
                {currentChapter === 4 && '📢'}
                {currentChapter === 5 && '✍️'}
                {currentChapter === 6 && '🦅'}
                {currentChapter === 7 && '⛪'}
                {currentChapter === 8 && '✍️'}
              </span>
            </div>
          </div>

          {chapter.image && (
            <div className="relative h-48 sm:h-56 overflow-hidden border-b border-amber-900/50">
              <img 
                src={chapter.image} 
                alt={chapter.title}
                className="w-full h-full object-cover opacity-80"
                style={{ filter: 'sepia(20%) contrast(1.1)' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent"></div>
            </div>
          )}

          <div className="p-4 sm:p-5">
            {showChapterIntro ? (
              <div>
                <div className="text-gray-300 leading-relaxed space-y-3 mb-5">
                  {chapter.narrative.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-sm sm:text-base">{paragraph}</p>
                  ))}
                </div>
                <button
                  onClick={() => setShowChapterIntro(false)}
                  className="bg-amber-700/80 hover:bg-amber-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                >
                  {chapter.type === 'timeline' ? '📋 Расположить события' : 
                   chapter.type === 'terms' ? '🔗 Соединить термины' : 
                   chapter.type === 'truefalse' ? '⚖️ Оценить утверждения' :
                   chapter.type === 'fillblank' ? '✍️ Заполнить пропуски' :
                   chapter.type === 'multi' ? '☑️ Выбрать утверждения' :
                   chapter.type === 'document' ? '📄 Анализировать документ' :
                   '➡️ Продолжить'}
                </button>
              </div>
            ) : (
              <div>
                {chapter.type === 'choice' && (
                  <div>
                    <p className="text-amber-200 font-semibold mb-4 text-base sm:text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {chapter.data.question}
                    </p>
                    <div className="space-y-2.5">
                      {shuffledChoices.map((choice, index) => (
                        <button
                          key={index}
                          onClick={() => handleChoice(index)}
                          disabled={feedback.show}
                          className={`w-full text-left p-3 sm:p-4 rounded-xl border transition-all duration-300 ${
                            feedback.show
                              ? choice.correct
                                ? 'bg-green-900/40 border-green-500 text-green-200'
                                : 'bg-gray-700/40 border-gray-600 text-gray-400'
                              : 'bg-gray-700/40 border-gray-600 hover:border-amber-500 hover:bg-gray-700/60 text-gray-200'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                              feedback.show && choice.correct ? 'border-green-500 bg-green-900/50' :
                              feedback.show ? 'border-gray-600' : 'border-gray-500'
                            }`}>
                              {feedback.show && choice.correct ? '✓' : String.fromCharCode(65 + index)}
                            </span>
                            <span className="text-sm">{choice.text}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chapter.type === 'truefalse' && (
                  <div>
                    <p className="text-amber-200 font-semibold mb-4 text-sm">{chapter.data.instruction}</p>
                    <div className="space-y-3">
                      {chapter.data.items.map((item: any, index: number) => (
                        <div key={index} className="bg-gray-700/40 border border-gray-600 rounded-xl p-4">
                          <p className="text-gray-200 text-sm mb-3">{item.statement}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleTrueFalse(index, true)}
                              disabled={trueFalseChecked}
                              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                trueFalseAnswers[index] === true
                                  ? 'bg-green-900/40 border border-green-600/60 text-green-300'
                                  : trueFalseChecked && item.isTrue
                                  ? 'bg-green-900/30 border border-green-700/50 text-green-400'
                                  : 'bg-gray-800 border border-gray-700/50 text-gray-400 hover:border-green-700/50'
                              }`}
                            >
                              ✓ Верно
                            </button>
                            <button
                              onClick={() => handleTrueFalse(index, false)}
                              disabled={trueFalseChecked}
                              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                                trueFalseAnswers[index] === false
                                  ? 'bg-red-900/40 border border-red-600/60 text-red-300'
                                  : trueFalseChecked && !item.isTrue
                                  ? 'bg-red-900/30 border border-red-700/50 text-red-400'
                                  : 'bg-gray-800 border border-gray-700/50 text-gray-400 hover:border-red-700/50'
                              }`}
                            >
                              ✗ Неверно
                            </button>
                          </div>
                          {trueFalseChecked && (
                            <div className={`mt-3 p-3 rounded-lg text-xs ${
                              trueFalseAnswers[index] === item.isTrue 
                                ? 'bg-green-900/20 text-green-300 border border-green-800/50' 
                                : 'bg-red-900/20 text-red-300 border border-red-800/50'
                            }`}>
                              {item.explanation}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {!trueFalseChecked && (
                      <button
                        onClick={handleTrueFalseCheck}
                        disabled={Object.keys(trueFalseAnswers).length < chapter.data.items.length}
                        className="mt-4 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                      >
                        ✓ Проверить
                      </button>
                    )}
                  </div>
                )}

                {chapter.type === 'timeline' && (
                  <div>
                    <p className="text-gray-400 text-sm mb-4">Используйте стрелки ▲▼ для сортировки событий:</p>
                    <div className="space-y-2">
                      {timelineOrder.map((eventId, index) => {
                        const event = shuffledTimeline.find((e: any) => e.id === eventId);
                        return (
                          <div key={eventId} className="flex items-center gap-2 bg-gray-700/40 border border-gray-600 rounded-lg p-3">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => moveTimelineItem(index, 'up')}
                                disabled={index === 0}
                                className="text-amber-400 hover:text-amber-200 disabled:text-gray-600 text-sm"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveTimelineItem(index, 'down')}
                                disabled={index === timelineOrder.length - 1}
                                className="text-amber-400 hover:text-amber-200 disabled:text-gray-600 text-sm"
                              >
                                ▼
                              </button>
                            </div>
                            <span className="text-gray-200 text-sm flex-1">{event?.text}</span>
                            <span className="text-gray-500 text-xs">#{index + 1}</span>
                          </div>
                        );
                      })}
                    </div>
                    {!feedback.show && (
                      <button
                        onClick={handleTimelineCheck}
                        className="mt-4 bg-amber-700/80 hover:bg-amber-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                      >
                        ✓ Проверить
                      </button>
                    )}
                  </div>
                )}

                {chapter.type === 'terms' && (
                  <TermsMatching
                    terms={chapter.data.terms}
                    shuffledDefs={shuffledDefs}
                    termMatches={termMatches}
                    selectedTerm={selectedTerm}
                    feedbackShow={feedback.show}
                    onTermSelect={handleTermSelect}
                    onTermMatch={handleTermMatch}
                  />
                )}

                {chapter.type === 'document' && (
                  <div>
                    <div className="bg-gray-700/40 border border-amber-900/50 rounded-xl p-4 mb-5 italic text-gray-300 text-sm leading-relaxed">
                      <p className="text-amber-400/70 text-xs font-semibold mb-2 not-italic">📄 Из «Доктрины фашизма», 1932:</p>
                      {chapter.narrative.split('\n\n').slice(1).join('\n\n')}
                    </div>
                    {chapter.data.questions.map((q: any, qi: number) => (
                      <div key={qi} className="mb-5">
                        <p className="text-amber-200 font-semibold mb-3 text-sm">
                          Вопрос {qi + 1}: {q.question}
                        </p>
                        <div className="space-y-2">
                          {docShuffled[qi]?.map((choice: any, ci: number) => (
                            <button
                              key={ci}
                              onClick={() => handleDocAnswer(qi, ci)}
                              disabled={docAnswers[qi] !== null && docAnswers[qi] !== undefined}
                              className={`w-full text-left p-3 rounded-xl border text-sm transition-all ${
                                docAnswers[qi] === ci
                                  ? 'bg-amber-900/30 border-amber-600/60 text-amber-200'
                                  : docAnswers[qi] !== null && docAnswers[qi] !== undefined
                                  ? 'bg-gray-700/40 border-gray-700/30 text-gray-500'
                                  : 'bg-gray-700/40 border-gray-600 hover:border-amber-500 text-gray-200'
                              }`}
                            >
                              {choice.text}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {!feedback.show && (
                      <button
                        onClick={handleDocCheck}
                        disabled={docAnswers.some(a => a === null || a === undefined)}
                        className="mt-2 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                      >
                        ✓ Проверить ответы
                      </button>
                    )}
                  </div>
                )}

                {chapter.type === 'fillblank' && (
                  <div>
                    <p className="text-gray-400 text-sm mb-4">Заполните пропуски (___) подходящими словами:</p>
                    <div className="space-y-4">
                      {chapter.data.items.map((item: any, index: number) => (
                        <div key={index} className="bg-gray-700/40 border border-gray-600 rounded-xl p-4">
                          <p className="text-gray-200 text-sm mb-3">{item.sentence}</p>
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={fillBlankAnswers[index] || ''}
                              onChange={(e) => {
                                const newAnswers = [...fillBlankAnswers];
                                newAnswers[index] = e.target.value;
                                setFillBlankAnswers(newAnswers);
                              }}
                              disabled={fillBlankChecked}
                              placeholder={item.hint}
                              className="flex-1 bg-gray-800 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-amber-600/60 focus:outline-none disabled:opacity-50"
                            />
                            {fillBlankChecked && (
                              <span className={`text-sm ${
                                item.blanks.some((b: string) => b.toLowerCase() === (fillBlankAnswers[index] || '').trim().toLowerCase())
                                  ? 'text-green-400' : 'text-red-400'
                              }`}>
                                {item.blanks.some((b: string) => b.toLowerCase() === (fillBlankAnswers[index] || '').trim().toLowerCase()) ? '✓' : `→ ${item.blanks[0]}`}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {!fillBlankChecked && (
                      <button
                        onClick={handleFillBlankCheck}
                        className="mt-4 bg-amber-700/80 hover:bg-amber-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                      >
                        ✓ Проверить
                      </button>
                    )}
                  </div>
                )}

                {chapter.type === 'multi' && (
                  <div>
                    <p className="text-amber-200 font-semibold mb-2 text-base sm:text-lg" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {chapter.data.question}
                    </p>
                    <p className="text-gray-500 text-xs mb-4">Выберите все верные утверждения (можно несколько)</p>
                    <div className="space-y-2.5">
                      {shuffledChoices.map((choice, index) => (
                        <button
                          key={index}
                          onClick={() => handleMultiToggle(index)}
                          disabled={multiChecked}
                          className={`w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                            multiChecked
                              ? choice.correct
                                ? 'bg-green-900/30 border-green-600/60 text-green-200'
                                : multiSelected.has(index)
                                ? 'bg-red-900/30 border-red-600/60 text-red-200'
                                : 'bg-gray-700/40 border-gray-700/30 text-gray-500'
                              : multiSelected.has(index)
                              ? 'bg-amber-900/30 border-amber-600/60 text-amber-200'
                              : 'bg-gray-700/40 border-gray-600 hover:border-amber-500 text-gray-200'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            <span className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                              multiSelected.has(index) ? 'border-amber-500 bg-amber-900/50 text-amber-300' : 'border-gray-600'
                            }`}>
                              {multiSelected.has(index) ? '✓' : ''}
                            </span>
                            <span className="text-sm">{choice.text}</span>
                          </span>
                          {multiChecked && choice.feedback && (
                            <p className="text-xs mt-2 ml-7 text-gray-400">{choice.feedback}</p>
                          )}
                        </button>
                      ))}
                    </div>
                    {!multiChecked && (
                      <button
                        onClick={handleMultiCheck}
                        disabled={multiSelected.size === 0}
                        className="mt-4 bg-amber-700/80 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                      >
                        ✓ Проверить ({multiSelected.size} выбрано)
                      </button>
                    )}
                  </div>
                )}

                {feedback.show && (
                  <div className={`mt-6 p-4 sm:p-5 rounded-xl border ${
                    feedback.correct 
                      ? 'bg-green-900/30 border-green-700' 
                      : 'bg-red-900/30 border-red-700'
                  }`}>
                    <p className={`font-semibold mb-1 ${feedback.correct ? 'text-green-300' : 'text-red-300'}`}>
                      {feedback.correct ? '✓ Верно!' : '✗ Не совсем...'}
                    </p>
                    <p className="text-gray-300 text-sm whitespace-pre-line">{feedback.text}</p>
                    <button
                      onClick={nextChapter}
                      className="mt-4 bg-amber-700/80 hover:bg-amber-600 text-white font-semibold py-2.5 px-6 rounded-xl transition-all duration-300 w-full sm:w-auto"
                    >
                      {currentChapter < chapters.length - 1 ? '➡️ Следующая глава' : '📊 Итоги расследования'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-gray-600 text-xs">
            Глава {currentChapter + 1}: {chapter.title} • {chapter.location}
          </p>
        </div>
      </div>
    </div>
  );
}

function TermsMatching({ terms, shuffledDefs, termMatches, selectedTerm, feedbackShow, onTermSelect, onTermMatch }: {
  terms: { term: string; definition: string }[];
  shuffledDefs: { term: string; definition: string }[];
  termMatches: Record<string, string>;
  selectedTerm: string | null;
  feedbackShow: boolean;
  onTermSelect: (term: string) => void;
  onTermMatch: (definition: string) => void;
}) {
  const remainingDefs = shuffledDefs.filter(item => !Object.values(termMatches).includes(item.definition));

  return (
    <div>
      <p className="text-gray-400 text-sm mb-4">Нажмите на термин, затем на его определение:</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="text-amber-300 font-semibold mb-2 text-sm">Термины:</p>
          <div className="space-y-2">
            {terms.map((item) => (
              <button
                key={item.term}
                onClick={() => onTermSelect(item.term)}
                disabled={!!termMatches[item.term] || feedbackShow}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all duration-200 ${
                  termMatches[item.term]
                    ? 'bg-green-900/30 border-green-700 text-green-300'
                    : selectedTerm === item.term
                    ? 'bg-amber-900/40 border-amber-500 text-amber-200'
                    : 'bg-gray-700/40 border-gray-600 hover:border-amber-500 text-gray-200'
                }`}
              >
                {item.term}
                {termMatches[item.term] && ' ✓'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-amber-300 font-semibold mb-2 text-sm">Определения:</p>
          <div className="space-y-2">
            {remainingDefs.map((item) => (
              <button
                key={item.definition}
                onClick={() => onTermMatch(item.definition)}
                disabled={!selectedTerm || feedbackShow}
                className={`w-full text-left p-3 rounded-lg border text-sm transition-all duration-200 ${
                  selectedTerm
                    ? 'bg-gray-700/40 border-gray-600 hover:border-amber-500 hover:bg-gray-700/60 text-gray-200'
                    : 'bg-gray-700/40 border-gray-600 text-gray-400'
                }`}
              >
                {item.definition}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
