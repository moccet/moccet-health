'use client';

import { useState, useEffect, useCallback } from 'react';
import './culture-assessment.css';

interface Option {
  text: string;
  score: number;
  key: string;
}

interface Question {
  type: 'welcome' | 'email' | 'text' | 'choice' | 'longtext' | 'scale';
  question?: string;
  helper?: string;
  field?: string;
  category?: string;
  options?: Option[];
  min?: number;
  max?: number;
}

interface CategoryScore {
  score: number;
  max: number;
  label: string;
}

const questions: Question[] = [
  { type: 'welcome' },
  { type: 'email', question: "What's your email?", helper: "We'll use this to follow up" },
  { type: 'text', field: 'name', question: "What's your name?", helper: "First name works :)" },
  { type: 'text', field: 'role', question: "What role are you applying for?", helper: "" },

  // Locus of Control
  {
    type: 'choice',
    category: 'locus_of_control',
    question: "You missed an important deadline. Looking back, the main reason was",
    options: [
      { text: "Unrealistic expectations from leadership", score: 0, key: 'A' },
      { text: "I underestimated complexity and should have flagged it earlier", score: 10, key: 'B' },
      { text: "Other team members didn't deliver their parts", score: 2, key: 'C' },
      { text: "Circumstances beyond anyone's control", score: 4, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'locus_of_control',
    question: "Think about your greatest professional achievement. What was the primary driver?",
    options: [
      { text: "Right place, right time", score: 2, key: 'A' },
      { text: "I outworked everyone and refused to give up", score: 10, key: 'B' },
      { text: "A great manager who supported me", score: 4, key: 'C' },
      { text: "Favorable market conditions", score: 0, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'locus_of_control',
    question: "When a project fails, your first instinct is to",
    options: [
      { text: "Identify what I could have done differently", score: 10, key: 'A' },
      { text: "Analyze what external factors contributed", score: 4, key: 'B' },
      { text: "Document lessons for the team", score: 7, key: 'C' },
      { text: "Move on. Dwelling doesn't help", score: 2, key: 'D' }
    ]
  },

  // Giver/Taker
  {
    type: 'choice',
    category: 'giver_score',
    question: "A colleague is struggling with something you could help with, but you're busy. What do you do?",
    options: [
      { text: "Focus on my work. They'll figure it out", score: 0, key: 'A' },
      { text: "Spend 5 minutes pointing them to resources", score: 6, key: 'B' },
      { text: "Block 30 minutes to help properly", score: 10, key: 'C' },
      { text: "Suggest they ask someone else", score: 2, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'giver_score',
    question: "You discover a shortcut that saves 2 hours weekly. What do you do?",
    options: [
      { text: "Keep it. My efficiency is my advantage", score: 0, key: 'A' },
      { text: "Share with my immediate team", score: 6, key: 'B' },
      { text: "Document and share company-wide", score: 10, key: 'C' },
      { text: "Mention it if asked", score: 3, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'giver_score',
    question: "A junior colleague gets credit for an idea you originally suggested to them. What do you do?",
    options: [
      { text: "Correct the record publicly", score: 2, key: 'A' },
      { text: "Feel frustrated but say nothing", score: 4, key: 'B' },
      { text: "Feel genuinely happy they succeeded with it", score: 10, key: 'C' },
      { text: "Mention it privately to my manager", score: 3, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'giver_score',
    question: "When you help someone, you typically",
    options: [
      { text: "Keep a mental note. They'll owe me", score: 0, key: 'A' },
      { text: "Expect nothing but appreciate reciprocation", score: 6, key: 'B' },
      { text: "Forget about it. Helping is its own reward", score: 10, key: 'C' },
      { text: "Hope it builds my reputation", score: 4, key: 'D' }
    ]
  },

  // Conscientiousness
  {
    type: 'choice',
    category: 'conscientiousness',
    question: "A task is 95% complete but the last 5% is tedious. What do you do?",
    options: [
      { text: "Ship it. 95% is good enough", score: 2, key: 'A' },
      { text: "Finish it properly even though it's boring", score: 10, key: 'B' },
      { text: "Ask if the last 5% is necessary", score: 4, key: 'C' },
      { text: "Delegate the remaining work", score: 3, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'conscientiousness',
    question: "How do you typically approach deadlines?",
    options: [
      { text: "Finish early with buffer for review", score: 10, key: 'A' },
      { text: "Complete just before deadline", score: 5, key: 'B' },
      { text: "Sometimes need extensions for quality", score: 2, key: 'C' },
      { text: "Deadlines are guidelines", score: 0, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'conscientiousness',
    question: "When given ambiguous instructions, you typically",
    options: [
      { text: "Wait for clarification", score: 2, key: 'A' },
      { text: "Make assumptions, start, then check in", score: 6, key: 'B' },
      { text: "Clarify critical points, own the rest", score: 10, key: 'C' },
      { text: "Do my best interpretation and submit", score: 4, key: 'D' }
    ]
  },

  // Grit
  {
    type: 'choice',
    category: 'grit',
    question: "When learning something difficult and not improving despite effort, what do you do?",
    options: [
      { text: "Accept I'm not suited for this", score: 0, key: 'A' },
      { text: "Take a break, try a different approach later", score: 6, key: 'B' },
      { text: "Increase effort and seek feedback", score: 10, key: 'C' },
      { text: "Focus on things I'm naturally better at", score: 3, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'grit',
    question: "How many years have you maintained focus on your primary career interest?",
    options: [
      { text: "Less than 2 years", score: 3, key: 'A' },
      { text: "2 to 5 years", score: 6, key: 'B' },
      { text: "5 to 10 years", score: 8, key: 'C' },
      { text: "10+ years", score: 10, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'grit',
    question: "When a goal becomes harder than expected, your motivation typically",
    options: [
      { text: "Decreases", score: 0, key: 'A' },
      { text: "Stays the same", score: 5, key: 'B' },
      { text: "Increases. I want it more", score: 10, key: 'C' },
      { text: "Fluctuates", score: 3, key: 'D' }
    ]
  },

  // Intrinsic Motivation
  {
    type: 'choice',
    category: 'intrinsic_motivation',
    question: "What motivates you most at work?",
    options: [
      { text: "Compensation and recognition", score: 3, key: 'A' },
      { text: "Freedom to solve problems my way", score: 7, key: 'B' },
      { text: "Getting measurably better at my craft", score: 8, key: 'C' },
      { text: "Contributing to something meaningful", score: 10, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'intrinsic_motivation',
    question: "If you could choose, you'd prefer",
    options: [
      { text: "Clear instructions, predictable work", score: 2, key: 'A' },
      { text: "Defined goals, freedom in execution", score: 10, key: 'B' },
      { text: "Complete autonomy, minimal oversight", score: 6, key: 'C' },
      { text: "Collaborative work, frequent check-ins", score: 5, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'intrinsic_motivation',
    question: "When you master a skill, your next instinct is to",
    options: [
      { text: "Leverage it for advancement", score: 4, key: 'A' },
      { text: "Find the next challenging skill", score: 10, key: 'B' },
      { text: "Teach others", score: 8, key: 'C' },
      { text: "Enjoy the comfort of competence", score: 2, key: 'D' }
    ]
  },

  // Psychological Safety
  {
    type: 'choice',
    category: 'psych_safety',
    question: "You notice a flaw in a proposed plan but everyone else agrees. What do you do?",
    options: [
      { text: "Stay quiet. I might be wrong", score: 0, key: 'A' },
      { text: "Raise it privately with the leader", score: 5, key: 'B' },
      { text: "Voice concern constructively in the meeting", score: 10, key: 'C' },
      { text: "Go along and see what happens", score: 2, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'psych_safety',
    question: "When a teammate's mistake affects you, your typical response",
    options: [
      { text: "Point out what they did wrong", score: 3, key: 'A' },
      { text: "Fix it quietly and move on", score: 4, key: 'B' },
      { text: "Assume positive intent, ask what happened", score: 10, key: 'C' },
      { text: "Escalate if it's a pattern", score: 5, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'psych_safety',
    question: "How do you respond when someone challenges your work?",
    options: [
      { text: "Defend my decisions", score: 2, key: 'A' },
      { text: "Listen, but usually conclude I was right", score: 4, key: 'B' },
      { text: "Genuinely consider if they're right", score: 10, key: 'C' },
      { text: "Feel attacked but hide it", score: 3, key: 'D' }
    ]
  },

  // Emotional Intelligence
  {
    type: 'choice',
    category: 'emotional_intelligence',
    question: "When frustrated with a colleague, what do you typically do?",
    options: [
      { text: "Express it directly", score: 2, key: 'A' },
      { text: "Vent to someone else first", score: 3, key: 'B' },
      { text: "Pause to understand my frustration first", score: 10, key: 'C' },
      { text: "Suppress it and move on", score: 4, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'emotional_intelligence',
    question: "How well do you understand your own weaknesses?",
    options: [
      { text: "Very well. I could list them clearly", score: 10, key: 'A' },
      { text: "Somewhat. Aware of the main ones", score: 6, key: 'B' },
      { text: "Still discovering them", score: 4, key: 'C' },
      { text: "I prefer focusing on strengths", score: 2, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'emotional_intelligence',
    question: "When receiving unexpected negative feedback, your first internal reaction",
    options: [
      { text: "Defensive", score: 2, key: 'A' },
      { text: "Hurt but processing", score: 5, key: 'B' },
      { text: "Curious. What can I learn?", score: 10, key: 'C' },
      { text: "Dismissive. They lack context", score: 0, key: 'D' }
    ]
  },

  // Deliberate Practice
  {
    type: 'choice',
    category: 'deliberate_practice',
    question: "Time spent on skill improvement outside work requirements",
    options: [
      { text: "Little to none", score: 2, key: 'A' },
      { text: "A few hours monthly", score: 5, key: 'B' },
      { text: "Weekly dedicated time", score: 8, key: 'C' },
      { text: "Daily. Non-negotiable", score: 10, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'deliberate_practice',
    question: "When you identify a weakness, you typically",
    options: [
      { text: "Work around it with strengths", score: 3, key: 'A' },
      { text: "Address it when urgent", score: 4, key: 'B' },
      { text: "Immediately create improvement plan", score: 10, key: 'C' },
      { text: "Accept it as a limitation", score: 0, key: 'D' }
    ]
  },

  // Crisis Response
  {
    type: 'choice',
    category: 'crisis_response',
    question: "11 PM Friday. Critical bug breaking AI model outputs for enterprise clients. Partner waiting at dinner. What do you do?",
    options: [
      { text: "Deal with it Monday", score: 0, key: 'A' },
      { text: "Message team to find cover", score: 2, key: 'B' },
      { text: "Apologize to partner, fix it now", score: 10, key: 'C' },
      { text: "Monitor from phone at dinner", score: 5, key: 'D' }
    ]
  },
  {
    type: 'choice',
    category: 'crisis_response',
    question: "Demo crashes 3 hours before major enterprise client presentation. First move?",
    options: [
      { text: "Reschedule with apologies", score: 0, key: 'A' },
      { text: "Panic, then troubleshoot", score: 3, key: 'B' },
      { text: "Diagnose while preparing backup", score: 10, key: 'C' },
      { text: "Delegate fix, prep talking points", score: 5, key: 'D' }
    ]
  },

  // Self-Assessment with honesty priming
  {
    type: 'longtext',
    field: 'weakness',
    question: "How would your harshest critic describe your biggest weakness?",
    helper: "Research shows self-aware candidates perform better. Be specific."
  },
  {
    type: 'scale',
    field: 'self_rating',
    question: "Rate your own performance in your last role",
    helper: "1 = Below expectations, 10 = Top performer",
    min: 1,
    max: 10
  },
  {
    type: 'scale',
    field: 'manager_rating',
    question: "What rating would your last manager give you if we called them?",
    helper: "We may verify this. Be accurate.",
    min: 1,
    max: 10
  },
  {
    type: 'longtext',
    field: 'hard_feedback',
    question: "What's the hardest feedback you've ever received, and what did you do about it?",
    helper: "We're looking for specificity and growth"
  }
];

const categoryLabels: Record<string, string> = {
  locus_of_control: 'Ownership',
  giver_score: 'Generosity',
  conscientiousness: 'Conscientiousness',
  grit: 'Grit',
  intrinsic_motivation: 'Motivation',
  psych_safety: 'Openness',
  emotional_intelligence: 'EQ',
  deliberate_practice: 'Growth',
  crisis_response: 'Crisis'
};

const categoryMaxScores: Record<string, number> = {
  locus_of_control: 30,
  giver_score: 40,
  conscientiousness: 30,
  grit: 30,
  intrinsic_motivation: 30,
  psych_safety: 30,
  emotional_intelligence: 30,
  deliberate_practice: 20,
  crisis_response: 20
};

export default function CultureAssessmentPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string | number>>({});
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [transitionClass, setTransitionClass] = useState('');
  const [showResults, setShowResults] = useState(false);

  const getTotalQuestions = () => {
    return questions.filter(q => q.type === 'choice').length;
  };

  const getCurrentChoiceQuestion = () => {
    return questions.slice(0, currentStep + 1).filter(q => q.type === 'choice').length;
  };

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const transition = useCallback((direction: 'forward' | 'back', callback: () => void) => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    const outClass = direction === 'forward' ? 'transitioning-out' : 'transitioning-in';
    setTransitionClass(outClass);

    setTimeout(() => {
      callback();
      const inClass = direction === 'forward' ? 'transitioning-in' : 'transitioning-out';
      setTransitionClass(inClass);

      requestAnimationFrame(() => {
        setTransitionClass('');
        setIsTransitioning(false);
      });
    }, 200);
  }, [isTransitioning]);

  const goBack = useCallback(() => {
    if (currentStep > 0 && !isTransitioning) {
      transition('back', () => {
        setCurrentStep(prev => prev - 1);
      });
    }
  }, [currentStep, isTransitioning, transition]);

  const goForward = useCallback(() => {
    const current = questions[currentStep];

    if (current.type === 'email') {
      if (!validateEmail(email)) {
        return;
      }
    }

    if (current.type === 'text') {
      const value = current.field === 'name' ? name : role;
      if (!value.trim()) return;
    }

    if (current.type === 'scale') {
      if (!textAnswers[current.field!]) return;
    }

    if (current.type === 'choice' && answers[currentStep] === undefined) {
      return;
    }

    transition('forward', () => {
      if (currentStep < questions.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        setShowResults(true);
      }
    });
  }, [currentStep, email, name, role, textAnswers, answers, isTransitioning, transition]);

  const handleAnswer = useCallback((optionIndex: number) => {
    if (isTransitioning) return;

    setAnswers(prev => ({ ...prev, [currentStep]: optionIndex }));

    setTimeout(() => {
      transition('forward', () => {
        if (currentStep < questions.length - 1) {
          setCurrentStep(prev => prev + 1);
        } else {
          setShowResults(true);
        }
      });
    }, 250);
  }, [currentStep, isTransitioning, transition]);

  const selectScale = (value: number) => {
    const current = questions[currentStep];
    setTextAnswers(prev => ({ ...prev, [current.field!]: value }));
  };

  const calculateScores = () => {
    const categoryScores: Record<string, CategoryScore> = {};
    Object.keys(categoryLabels).forEach(key => {
      categoryScores[key] = { score: 0, max: categoryMaxScores[key], label: categoryLabels[key] };
    });

    let totalScore = 0;

    Object.entries(answers).forEach(([qIndex, optionIndex]) => {
      const question = questions[parseInt(qIndex)];
      if (question.type === 'choice' && question.options?.[optionIndex]) {
        const score = question.options[optionIndex].score;
        totalScore += score;
        if (question.category && categoryScores[question.category]) {
          categoryScores[question.category].score += score;
        }
      }
    });

    return { totalScore, categoryScores, maxScore: 260 };
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;

      const current = questions[currentStep];

      if (e.key === 'Enter') {
        if (current.type === 'welcome') {
          transition('forward', () => setCurrentStep(prev => prev + 1));
        } else if (['email', 'text', 'longtext', 'scale'].includes(current.type)) {
          goForward();
        }
      }

      if (current.type === 'choice') {
        const keyMap: Record<string, number> = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, '1': 0, '2': 1, '3': 2, '4': 3 };
        const index = keyMap[e.key.toLowerCase()];
        if (index !== undefined && current.options?.[index]) {
          handleAnswer(index);
        }
      }

      if (current.type === 'scale' && !isNaN(Number(e.key))) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 10) {
          selectScale(num);
        }
        if (e.key === '0') {
          selectScale(10);
        }
      }

      if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
        const activeElement = document.activeElement;
        if (activeElement?.tagName !== 'INPUT' && activeElement?.tagName !== 'TEXTAREA') {
          goBack();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, isTransitioning, goBack, goForward, handleAnswer, transition]);

  const current = questions[currentStep];
  const progressPercent = (currentStep / (questions.length - 1)) * 100;

  if (showResults) {
    const { totalScore, categoryScores, maxScore } = calculateScores();
    const overallPct = Math.round((totalScore / maxScore) * 100);

    return (
      <div className="culture-assessment">
        <div className="app">
          <div className="logo">
            <span className="logo-text">moccet</span>
          </div>

          <div className="content">
            <div className="question-container animate-in">
              <div className="results">
                <div className="results-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                </div>
                <h1>Thanks for completing the assessment</h1>
                <p className="subtitle">We appreciate you taking the time{name ? `, ${name}` : ''}. Our team will review your responses and be in touch soon.</p>

                <div className="overall-score">
                  <span className="overall-score-value">{overallPct}%</span>
                  <span className="overall-score-label">Overall Score</span>
                </div>

                <div className="insights-section">
                  <h3 className="insights-title">Breakdown</h3>
                  {Object.entries(categoryScores).map(([key, data]) => {
                    const pct = Math.round((data.score / data.max) * 100);
                    return (
                      <div key={key} className="insight-row">
                        <span className="insight-label">{data.label}</span>
                        <div className="insight-right">
                          <span className="insight-value">{pct}%</span>
                          <div className="insight-bar-container">
                            <div
                              className="insight-bar-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="written-note">Your written responses will be reviewed by our team for depth and self-awareness.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="culture-assessment">
      <div className="app">
        <div className={`progress-bar ${currentStep > 0 ? 'visible' : ''}`}>
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="logo">
          <span className="logo-text">moccet</span>
        </div>

        <div className="content">
          <div className={`question-container ${transitionClass}`}>
            {current.type === 'welcome' && (
              <div className="welcome animate-in">
                <h1><span className="moccet-text">moccet</span> culture assessment</h1>
                <p>This helps us understand how you approach challenges, work with others, and grow. There are no trick questions. Answer based on what you&apos;d actually do.</p>
                <p className="time">Takes about 12 minutes</p>
                <div className="honesty-note">
                  Studies show that honest self-assessment is the strongest predictor of job performance. We value authenticity over perfection.
                </div>
                <button
                  className="btn-primary"
                  onClick={() => transition('forward', () => setCurrentStep(prev => prev + 1))}
                >
                  Start <span className="arrow">→</span>
                </button>
              </div>
            )}

            {current.type === 'email' && (
              <div className="animate-in">
                <div className="question-header">
                  <span className="question-number">{currentStep} →</span>
                  <h2 className="question-text">{current.question}</h2>
                </div>
                {current.helper && <p className="question-helper">{current.helper}</p>}
                <div className="input-wrapper">
                  <input
                    type="email"
                    className="text-input"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoFocus
                  />
                  <button className="btn-ok" onClick={goForward}>
                    OK
                    <span className="hint">↵</span>
                  </button>
                </div>
              </div>
            )}

            {current.type === 'text' && (
              <div className="animate-in">
                <div className="question-header">
                  <span className="question-number">{currentStep} →</span>
                  <h2 className="question-text">{current.question}</h2>
                </div>
                {current.helper && <p className="question-helper">{current.helper}</p>}
                <div className="input-wrapper">
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Type here..."
                    value={current.field === 'name' ? name : role}
                    onChange={(e) => {
                      if (current.field === 'name') {
                        setName(e.target.value);
                      } else {
                        setRole(e.target.value);
                      }
                    }}
                    autoFocus
                  />
                  <button className="btn-ok" onClick={goForward}>
                    OK
                    <span className="hint">↵</span>
                  </button>
                </div>
              </div>
            )}

            {current.type === 'longtext' && (
              <div className="animate-in">
                <div className="question-header">
                  <span className="question-number">✎</span>
                  <h2 className="question-text">{current.question}</h2>
                </div>
                {current.helper && <p className="question-helper">{current.helper}</p>}
                <div className="input-wrapper">
                  <textarea
                    className="textarea-input"
                    placeholder="Type your answer..."
                    rows={4}
                    value={(textAnswers[current.field!] as string) || ''}
                    onChange={(e) => setTextAnswers(prev => ({ ...prev, [current.field!]: e.target.value }))}
                    autoFocus
                  />
                  <button className="btn-ok" onClick={goForward}>
                    OK
                    <span className="hint">↵</span>
                  </button>
                </div>
              </div>
            )}

            {current.type === 'scale' && (
              <div className="animate-in">
                <div className="question-header">
                  <span className="question-number">✎</span>
                  <h2 className="question-text">{current.question}</h2>
                </div>
                {current.helper && <p className="question-helper">{current.helper}</p>}
                <div className="scale-container">
                  {Array.from({ length: (current.max || 10) - (current.min || 1) + 1 }, (_, i) => (current.min || 1) + i).map((num) => (
                    <button
                      key={num}
                      className={`scale-btn ${textAnswers[current.field!] === num ? 'selected' : ''}`}
                      onClick={() => selectScale(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <div className="scale-labels">
                  <span>Below expectations</span>
                  <span>Top performer</span>
                </div>
                <button className="btn-ok" onClick={goForward} style={{ marginTop: '20px' }}>
                  OK
                  <span className="hint">↵</span>
                </button>
              </div>
            )}

            {current.type === 'choice' && (
              <div className="animate-in">
                <div className="question-header">
                  <span className="question-number">{getCurrentChoiceQuestion()} →</span>
                  <h2 className="question-text">{current.question}</h2>
                </div>
                <div className="options-container">
                  {current.options?.map((opt, idx) => (
                    <button
                      key={idx}
                      className={`option-btn ${answers[currentStep] === idx ? 'selected' : ''}`}
                      onClick={() => handleAnswer(idx)}
                    >
                      <span className="option-key">{opt.key}</span>
                      <span className="option-text">{opt.text}</span>
                    </button>
                  ))}
                </div>
                <p className="keyboard-hint">Press A, B, C, or D</p>
              </div>
            )}
          </div>
        </div>

        <div className={`nav-footer ${current.type === 'welcome' ? 'hidden' : ''}`}>
          <div className="nav-buttons">
            <button
              className="nav-btn"
              onClick={goBack}
              disabled={currentStep === 0}
            >
              <svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <button className="nav-btn" onClick={goForward}>
              <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
          <span className="nav-progress">
            {current.type === 'choice' ? `${getCurrentChoiceQuestion()} of ${getTotalQuestions()}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
