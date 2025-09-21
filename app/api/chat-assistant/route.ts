import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    const lastMessage = messages[messages.length - 1]?.content.toLowerCase() || '';

    // Simple response logic for demo
    let responseContent = "I'm here to help you learn about Moccet Health's AI-powered health monitoring solutions. What would you like to know?";
    let suggestedActions = [];

    if (lastMessage.includes('price') || lastMessage.includes('cost') || lastMessage.includes('pricing')) {
      responseContent = "Moccet Health offers two pricing tiers:\n\n• **Moccet Health** at $99/month - Personal AI model with predictive alerts and full encryption\n• **Moccet + The Wellness** at $299/month - Includes everything plus quarterly blood panels and annual MRI\n\nWould you like to pre-order or learn more about the features?";
      suggestedActions = [
        { type: 'brief', label: 'View Pricing Details', value: '#pricingSection' },
        { type: 'demo', label: 'Join Waitlist', value: 'demo' }
      ];
    } else if (lastMessage.includes('demo') || lastMessage.includes('waitlist') || lastMessage.includes('join')) {
      responseContent = "Great! You can join our waitlist to be among the first to experience Moccet Health when we launch in Q2 2026. Click below to get started!";
      suggestedActions = [
        { type: 'demo', label: 'Join Waitlist Now', value: 'demo' }
      ];
    } else if (lastMessage.includes('feature') || lastMessage.includes('what') || lastMessage.includes('how')) {
      responseContent = "Moccet Health uses specialized AI models to:\n\n• Detect diseases up to 18 months before symptoms appear\n• Monitor your biomarkers 24/7\n• Provide personalized health insights\n• Maintain complete privacy with end-to-end encryption\n\nWhat aspect interests you most?";
      suggestedActions = [
        { type: 'quick-reply', label: 'Early Detection', value: 'Tell me about early disease detection' },
        { type: 'quick-reply', label: 'Privacy Features', value: 'How does the privacy work?' },
        { type: 'demo', label: 'Join Waitlist', value: 'demo' }
      ];
    } else if (lastMessage.includes('privacy') || lastMessage.includes('security') || lastMessage.includes('data')) {
      responseContent = "Your privacy is our top priority. Moccet Health uses:\n\n• End-to-end encryption - only you hold the keys\n• Zero-knowledge architecture - we can never see your data\n• Local processing on your device\n• HIPAA compliant infrastructure\n\nYour health data stays yours forever. Want to learn more?";
      suggestedActions = [
        { type: 'quick-reply', label: 'Learn More', value: 'Tell me more about security features' },
        { type: 'demo', label: 'Join Waitlist', value: 'demo' }
      ];
    } else if (lastMessage.includes('cancer') || lastMessage.includes('detect') || lastMessage.includes('disease')) {
      responseContent = "Our AI models have shown remarkable accuracy in early detection:\n\n• Pancreatic cancer: 94% accuracy at 18 months before symptoms\n• Lung cancer: 89% accuracy at 12 months\n• Heart disease: Prediction weeks before events\n\nThis early detection can be life-saving. Would you like to secure your spot?";
      suggestedActions = [
        { type: 'demo', label: 'Join Waitlist', value: 'demo' },
        { type: 'quick-reply', label: 'Learn More', value: 'How does the AI detection work?' }
      ];
    } else {
      // Default response with options
      suggestedActions = [
        { type: 'quick-reply', label: 'Features & Benefits', value: 'What features does Moccet Health offer?' },
        { type: 'quick-reply', label: 'Pricing', value: 'What are the pricing options?' },
        { type: 'demo', label: 'Join Waitlist', value: 'demo' }
      ];
    }

    return NextResponse.json({
      content: responseContent,
      suggestedActions
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process message' },
      { status: 500 }
    );
  }
}