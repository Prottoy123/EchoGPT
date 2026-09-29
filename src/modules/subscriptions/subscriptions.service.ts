import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly usersService: UsersService) {}

  /**
   * List available subscription plans and their feature matrices
   */
  getPlans() {
    return {
      plans: [
        {
          planName: 'FREE',
          price: '$0/month',
          requestLimit: 50,
          resetPeriod: 'MONTHLY',
          features: [
            '50 AI chat requests per month',
            'Access to Google Gemini & OpenAI models',
            'Full DuckDuckGo web search integration',
            'Conversation history storage & management',
            'Standard inference speed',
          ],
        },
        {
          planName: 'PREMIUM',
          price: '$19/month',
          requestLimit: 1000,
          resetPeriod: 'MONTHLY',
          features: [
            '1,000 AI chat requests per month',
            'Access to Claude 3.5 Sonnet, GPT-4o-mini & Gemini Flash',
            'Priority low-latency inference routing',
            'Unlimited web search with snippet summaries',
            'Extended 10-message conversational context memory',
            'Priority support & upcoming feature previews',
          ],
        },
      ],
    };
  }

  async getStatus(userId: string) {
    return this.usersService.getSubscriptionStatus(userId);
  }

  async getRemainingRequests(userId: string) {
    return this.usersService.getRemainingRequests(userId);
  }

  async upgrade(userId: string) {
    return this.usersService.upgradePlan(userId);
  }

  async downgrade(userId: string) {
    return this.usersService.downgradePlan(userId);
  }
}
