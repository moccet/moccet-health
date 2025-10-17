'use client';

import { useState, useRef } from 'react';
import './onboarding.css';

export default function SageOnboarding() {
  const [currentScreen, setCurrentScreen] = useState(1);
  const [formData, setFormData] = useState<any>({});
  const [selectedOptions, setSelectedOptions] = useState<{ [key: number]: string[] }>({});
  const [expandedBoxes, setExpandedBoxes] = useState<Set<number>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<{ [key: string]: File | null }>({});
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');

  const totalScreens = 14;
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const updateProgress = () => {
    return (currentScreen / totalScreens) * 100;
  };

  const nextScreen = () => {
    setCurrentScreen((prev) => prev + 1);
    window.scrollTo(0, 0);
  };

  const toggleOption = (screenNum: number, value: string) => {
    setSelectedOptions((prev) => {
      const current = prev[screenNum] || [];
      if (current.includes(value)) {
        return { ...prev, [screenNum]: current.filter((v) => v !== value) };
      } else {
        return { ...prev, [screenNum]: [...current, value] };
      }
    });
  };

  const selectOption = (screenNum: number, value: string) => {
    setSelectedOptions({ ...selectedOptions, [screenNum]: [value] });
  };

  const handleFileUpload = (key: string, file: File | null) => {
    if (file) {
      setUploadedFiles({ ...uploadedFiles, [key]: file });
    }
  };

  const toggleExpand = (index: number) => {
    setExpandedBoxes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const connectWearable = (type: string) => {
    setConnectedDevices((prev) => new Set([...prev, type]));
    setTimeout(() => {
      alert(`Successfully connected to ${type}`);
    }, 300);
  };

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const submitEmail = async () => {
    if (validateEmail(email)) {
      setFormData({ ...formData, email });
      console.log('Form data:', { ...formData, email });
      // TODO: Send to backend
      nextScreen();
    }
  };

  const hasSelectedOptions = (screenNum: number) => {
    const options = selectedOptions[screenNum] || [];
    return options.length > 0;
  };

  return (
    <div className="onboarding-wrapper">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${updateProgress()}%` }}></div>
      </div>

      <div className="header">
        <div className="logo">sage</div>
      </div>

      <div className="container">
        {/* Screen 1: Welcome */}
        <div className={`screen ${currentScreen === 1 ? 'active' : ''}`}>
          <h1>Welcome to <span className="brand-text">sage</span></h1>
          <p className="subtitle">Build nutrition plans from your metabolic state. This takes about 5 minutes.</p>

          <div className="info-box">
            <div className="info-title">What you&apos;ll need</div>
            <div className="info-text">
              Recent blood work, wearable device (optional), and a few minutes to answer questions about your diet and lifestyle.
            </div>
          </div>

          <button className="btn" onClick={nextScreen}>Get Started</button>
        </div>

        {/* Screen 2: Dietary Goals */}
        <div className={`screen ${currentScreen === 2 ? 'active' : ''}`}>
          <h2>What are your nutrition goals?</h2>
          <p className="subtitle">Choose all that apply</p>

          {['energy', 'composition', 'performance', 'health', 'gut'].map((goal) => (
            <div
              key={goal}
              className={`option ${selectedOptions[2]?.includes(goal) ? 'selected' : ''}`}
              onClick={() => toggleOption(2, goal)}
            >
              <div className="option-title">
                {goal === 'energy' && 'Improve Energy'}
                {goal === 'composition' && 'Body Composition'}
                {goal === 'performance' && 'Athletic Performance'}
                {goal === 'health' && 'Metabolic Health'}
                {goal === 'gut' && 'Digestive Health'}
              </div>
              <div className="option-subtitle">
                {goal === 'energy' && 'Stable energy throughout the day'}
                {goal === 'composition' && 'Lose fat or build muscle'}
                {goal === 'performance' && 'Support training and recovery'}
                {goal === 'health' && 'Improve biomarkers and longevity'}
                {goal === 'gut' && 'Support gut microbiome'}
              </div>
            </div>
          ))}

          <button className="btn" onClick={nextScreen} disabled={!hasSelectedOptions(2)}>Continue</button>
        </div>

        {/* Screen 3: Dietary Preferences */}
        <div className={`screen ${currentScreen === 3 ? 'active' : ''}`}>
          <h2>Any dietary preferences?</h2>
          <p className="subtitle">sage will work within these constraints</p>

          {['none', 'vegetarian', 'vegan', 'keto', 'paleo', 'mediterranean'].map((pref) => (
            <div
              key={pref}
              className={`option ${selectedOptions[3]?.includes(pref) ? 'selected' : ''}`}
              onClick={() => selectOption(3, pref)}
            >
              <div className="option-title">
                {pref === 'none' && 'No restrictions'}
                {pref === 'vegetarian' && 'Vegetarian'}
                {pref === 'vegan' && 'Vegan'}
                {pref === 'keto' && 'Ketogenic / Low-carb'}
                {pref === 'paleo' && 'Paleo'}
                {pref === 'mediterranean' && 'Mediterranean'}
              </div>
            </div>
          ))}

          <button className="btn" onClick={nextScreen} disabled={!hasSelectedOptions(3)}>Continue</button>
        </div>

        {/* Screen 4: Cooking Ability */}
        <div className={`screen ${currentScreen === 4 ? 'active' : ''}`}>
          <h2>How much time can you spend on meal prep?</h2>

          {[
            { value: 'minimal', title: 'Minimal - Under 30 min/day', subtitle: 'Simple meals, minimal prep' },
            { value: 'moderate', title: 'Moderate - 30-60 min/day', subtitle: 'Some cooking, batch prep possible' },
            { value: 'flexible', title: 'Flexible - 60+ min/day', subtitle: 'Enjoy cooking, open to complex recipes' }
          ].map((option) => (
            <div
              key={option.value}
              className={`option ${selectedOptions[4]?.includes(option.value) ? 'selected' : ''}`}
              onClick={() => selectOption(4, option.value)}
            >
              <div className="option-title">{option.title}</div>
              <div className="option-subtitle">{option.subtitle}</div>
            </div>
          ))}

          <button className="btn" onClick={nextScreen} disabled={!hasSelectedOptions(4)}>Continue</button>
        </div>

        {/* Screen 5: Transition - Why Biology Matters */}
        <div className={`screen ${currentScreen === 5 ? 'active' : ''}`}>
          <div className="animated-text">
            <div>
              The same meal affects two people <span className="highlight">completely differently</span>.<br /><br />
              sage builds plans from <span className="highlight">your metabolic state</span>.
            </div>
          </div>
          <button className="btn" onClick={nextScreen}>Next</button>
        </div>

        {/* Screen 6: Blood Work Upload */}
        <div className={`screen ${currentScreen === 6 ? 'active' : ''}`}>
          <h2>Upload your blood work</h2>
          <p className="subtitle">Labs show how your body processes different nutrients</p>

          <div
            className={`upload-zone ${uploadedFiles['bloodWork'] ? 'has-file' : ''}`}
            onClick={() => fileInputRefs.current['bloodWork']?.click()}
          >
            <div className="upload-text">
              {uploadedFiles['bloodWork'] ? uploadedFiles['bloodWork'].name : 'Upload your lab results'}
            </div>
            <div className="upload-subtext">
              {uploadedFiles['bloodWork'] ? 'File uploaded successfully' : 'PDF, JPG, or PNG • Max 10MB'}
            </div>
          </div>
          <input
            type="file"
            ref={(el) => (fileInputRefs.current['bloodWork'] = el)}
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload('bloodWork', e.target.files?.[0] || null)}
          />

          <div className={`info-box info-expandable ${expandedBoxes.has(61) ? 'expanded' : ''}`} onClick={() => toggleExpand(61)}>
            <div className="info-title">What labs do you need?</div>
            <div className="info-content">
              <div className="info-text">
                Metabolic panel (glucose, insulin), lipid panel, liver function, inflammatory markers (CRP), and micronutrient status (vitamin D, B12, iron, magnesium). Labs from the past 3 months work best.
              </div>
            </div>
          </div>

          <div className={`info-box info-expandable ${expandedBoxes.has(62) ? 'expanded' : ''}`} onClick={() => toggleExpand(62)}>
            <div className="info-title">How do labs affect meal plans?</div>
            <div className="info-content">
              <div className="info-text">
                High fasting glucose → meals emphasize protein and fiber, minimize refined carbs. Elevated triglycerides → specific fat ratios and timing. Low iron → heme sources paired with vitamin C. Your labs determine which foods help versus harm.
              </div>
            </div>
          </div>

          <div className="skip-text" onClick={nextScreen}>Skip for now - I&apos;ll add this later</div>
          <button className="btn" onClick={nextScreen} disabled={!uploadedFiles['bloodWork']}>Continue</button>
        </div>

        {/* Screen 7: Wearables */}
        <div className={`screen ${currentScreen === 7 ? 'active' : ''}`}>
          <h2>Connect your wearable</h2>
          <p className="subtitle">Activity, sleep, and glucose data help optimize meal timing</p>

          {[
            { type: 'apple', name: 'Apple Health' },
            { type: 'cgm', name: 'CGM (Dexcom, Libre, Levels)' },
            { type: 'garmin', name: 'Garmin' },
            { type: 'whoop', name: 'Whoop' },
            { type: 'oura', name: 'Oura Ring' }
          ].map((device) => (
            <div
              key={device.type}
              className={`connect-button ${connectedDevices.has(device.type) ? 'connected' : ''}`}
              onClick={() => connectWearable(device.type)}
            >
              <div className="connect-info">
                <div className="connect-name">{device.name}</div>
                <div className="connect-status">
                  {connectedDevices.has(device.type) ? 'Connected' : 'Not connected'}
                </div>
              </div>
            </div>
          ))}

          <div className="info-box">
            <div className="info-title">Why wearables matter for nutrition</div>
            <div className="info-text">
              CGM data reveals when your glucose spikes. Sleep quality affects insulin sensitivity. Activity patterns determine carb needs. sage uses this to time meals when your body handles them best.
            </div>
          </div>

          <div className="skip-text" onClick={nextScreen}>Skip for now - I&apos;ll add this later</div>
          <button className="btn" onClick={nextScreen}>Continue</button>
        </div>

        {/* Screen 8: Microbiome Upload */}
        <div className={`screen ${currentScreen === 8 ? 'active' : ''}`}>
          <h2>Upload microbiome test results</h2>
          <p className="subtitle">Your gut bacteria determine which foods you can metabolize effectively</p>

          <div
            className={`upload-zone ${uploadedFiles['microbiome'] ? 'has-file' : ''}`}
            onClick={() => fileInputRefs.current['microbiome']?.click()}
          >
            <div className="upload-text">
              {uploadedFiles['microbiome'] ? uploadedFiles['microbiome'].name : 'Upload your lab results'}
            </div>
            <div className="upload-subtext">
              {uploadedFiles['microbiome'] ? 'File uploaded successfully' : 'PDF from Viome, Thorne, Tiny Health, etc.'}
            </div>
          </div>
          <input
            type="file"
            ref={(el) => (fileInputRefs.current['microbiome'] = el)}
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload('microbiome', e.target.files?.[0] || null)}
          />

          <div className={`info-box info-expandable ${expandedBoxes.has(81) ? 'expanded' : ''}`} onClick={() => toggleExpand(81)}>
            <div className="info-title">Why microbiome matters</div>
            <div className="info-content">
              <div className="info-text">
                Different bacterial species process different compounds. Low diversity means certain fibers cause problems. Inflammatory species drive systemic inflammation. sage uses your microbiome composition to select foods your gut can actually handle.
              </div>
            </div>
          </div>

          <div className={`info-box info-expandable ${expandedBoxes.has(82) ? 'expanded' : ''}`} onClick={() => toggleExpand(82)}>
            <div className="info-title">How to get tested</div>
            <div className="info-content">
              <div className="info-text">
                Companies like Viome, Thorne, or Tiny Health offer at-home microbiome testing. Results show bacterial composition, metabolic capacity, and specific food recommendations.
              </div>
            </div>
          </div>

          <div className="skip-text" onClick={nextScreen}>Skip for now - I&apos;ll add this later</div>
          <button className="btn" onClick={nextScreen}>Continue</button>
        </div>

        {/* Screen 9: Genome Upload */}
        <div className={`screen ${currentScreen === 9 ? 'active' : ''}`}>
          <h2>Upload genome data</h2>
          <p className="subtitle">Genetic variants affect how you metabolize specific nutrients</p>

          <div
            className={`upload-zone ${uploadedFiles['genome'] ? 'has-file' : ''}`}
            onClick={() => fileInputRefs.current['genome']?.click()}
          >
            <div className="upload-text">
              {uploadedFiles['genome'] ? uploadedFiles['genome'].name : 'Upload your lab results'}
            </div>
            <div className="upload-subtext">
              {uploadedFiles['genome'] ? 'File uploaded successfully' : 'Raw data from 23andMe, Ancestry, etc.'}
            </div>
          </div>
          <input
            type="file"
            ref={(el) => (fileInputRefs.current['genome'] = el)}
            accept=".txt,.csv"
            style={{ display: 'none' }}
            onChange={(e) => handleFileUpload('genome', e.target.files?.[0] || null)}
          />

          <div className={`info-box info-expandable ${expandedBoxes.has(9) ? 'expanded' : ''}`} onClick={() => toggleExpand(9)}>
            <div className="info-title">What genome data reveals</div>
            <div className="info-content">
              <div className="info-text">
                MTHFR variants affect folate metabolism. Vitamin D receptor variants affect absorption. Caffeine metabolism genes determine tolerance. Lactose tolerance genes show if dairy works. sage accounts for these when building meal plans.
              </div>
            </div>
          </div>

          <div className="skip-text" onClick={nextScreen}>Skip for now - I&apos;ll add this later</div>
          <button className="btn" onClick={nextScreen}>Continue</button>
        </div>

        {/* Screen 10: Connected Apps */}
        <div className={`screen ${currentScreen === 10 ? 'active' : ''}`}>
          <h2>Connect your calendar</h2>
          <p className="subtitle">Work stress and travel affect eating patterns. Let sage adapt to real life.</p>

          {[
            { type: 'google-cal', name: 'Google Calendar' },
            { type: 'outlook', name: 'Outlook Calendar' }
          ].map((app) => (
            <div
              key={app.type}
              className={`connect-button ${connectedDevices.has(app.type) ? 'connected' : ''}`}
              onClick={() => connectWearable(app.type)}
            >
              <div className="connect-info">
                <div className="connect-name">{app.name}</div>
                <div className="connect-status">
                  {connectedDevices.has(app.type) ? 'Connected' : 'Not connected'}
                </div>
              </div>
            </div>
          ))}

          <div className="info-box">
            <div className="info-title">How calendar helps nutrition</div>
            <div className="info-text">
              Early morning meetings mean breakfast needs to be fast. Late work nights affect dinner timing. Travel periods require portable meals. sage builds plans that work with your schedule, not against it.
            </div>
          </div>

          <div className="skip-text" onClick={nextScreen}>Skip for now - I&apos;ll add this later</div>
          <button className="btn" onClick={nextScreen}>Continue</button>
        </div>

        {/* Screen 11: Food Restrictions */}
        <div className={`screen ${currentScreen === 11 ? 'active' : ''}`}>
          <h2>Any food allergies or restrictions?</h2>
          <p className="subtitle">sage will avoid these and find alternatives</p>

          {[
            { value: 'none', title: 'No restrictions' },
            { value: 'dairy', title: 'Dairy allergy/intolerance' },
            { value: 'gluten', title: 'Gluten sensitivity/celiac' },
            { value: 'nuts', title: 'Nut allergies' },
            { value: 'shellfish', title: 'Shellfish allergy' },
            { value: 'other', title: 'Other restrictions' }
          ].map((restriction) => (
            <div
              key={restriction.value}
              className={`option ${selectedOptions[11]?.includes(restriction.value) ? 'selected' : ''}`}
              onClick={() => selectOption(11, restriction.value)}
            >
              <div className="option-title">{restriction.title}</div>
            </div>
          ))}

          <button className="btn" onClick={nextScreen} disabled={!hasSelectedOptions(11)}>Continue</button>
        </div>

        {/* Screen 12: Transition - Processing */}
        <div className={`screen ${currentScreen === 12 ? 'active' : ''}`}>
          <div className="animated-text">
            <div>
              sage is analyzing your <span className="highlight">metabolic state</span>, <span className="highlight">microbiome capacity</span>, and <span className="highlight">life constraints</span>.<br /><br />
              Your personalized meal plan is almost ready.
            </div>
          </div>
          <button className="btn" onClick={nextScreen}>Next</button>
        </div>

        {/* Screen 13: Email Gate */}
        <div className={`screen ${currentScreen === 13 ? 'active' : ''}`}>
          <h2>Get your nutrition plan</h2>
          <p className="subtitle">We&apos;ll send your personalized meal plan to your email within 24 hours</p>

          <input
            type="email"
            className="email-input"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div className="info-box" style={{ marginTop: '24px' }}>
            <div className="info-text" style={{ textAlign: 'center' }}>
              By continuing, you agree to receive your personalized nutrition plan and updates from moccet. We never share your data.
            </div>
          </div>

          <button className="btn" onClick={submitEmail} disabled={!validateEmail(email)}>Send My Plan</button>

          <div style={{ textAlign: 'center', marginTop: '32px', color: 'rgba(255, 255, 255, 0.7)', fontSize: '14px' }}>
            Want even more? <a href="https://moccet.com" style={{ color: 'rgba(255, 255, 255, 0.95)', textDecoration: 'underline', fontWeight: 500 }}>Join the waitlist</a> for daily insights across all aspects of health.
          </div>
        </div>

        {/* Screen 14: Success */}
        <div className={`screen ${currentScreen === 14 ? 'active' : ''}`}>
          <div style={{ textAlign: 'center' }}>
            <h1>Check your email</h1>
            <p className="subtitle">Your personalized nutrition plan will arrive within 24 hours.</p>

            <div className="info-box">
              <div className="info-title">What&apos;s next</div>
              <div className="info-text">
                Review your meal plan, start implementing, and track changes in your biomarkers over 8-12 weeks. Want continuous optimization? Join the waitlist for moccet - the full platform that delivers daily insights, not just meal plans.
              </div>
            </div>

            <button className="btn" onClick={() => window.location.href = 'https://moccet.com'}>Join moccet Waitlist</button>
          </div>
        </div>
      </div>
    </div>
  );
}
