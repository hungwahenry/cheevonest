import { Injectable } from '@nestjs/common';
import { ValidationFailedException } from '../../../../common/exceptions/api.exception';
import { EventForResource } from '../../../events/events.service';

@Injectable()
export class PublishRules {
  ensurePublishable(event: EventForResource): void {
    const errors: Record<string, string[]> = {};

    if (!event.description) {
      errors.description = ['Add a description before publishing.'];
    }
    if (!event.startsAt) {
      errors.starts_at = ['Set a start date before publishing.'];
    }
    if (!event.endsAt) {
      errors.ends_at = ['Set an end date before publishing.'];
    }
    if (event.startsAt && event.startsAt <= new Date()) {
      errors.starts_at = ['Start date is in the past.'];
    }
    if (event.presaleUntil && event.presaleUntil <= new Date()) {
      errors.presale_until = [
        'Presale end is in the past — remove it or push it out.',
      ];
    }
    if (
      event.presaleUntil &&
      event.startsAt &&
      event.presaleUntil > event.startsAt
    ) {
      errors.presale_until = ['Presale must end before the event starts.'];
    }
    if (!event.venueName && !event.address) {
      errors.location = ['Add a location before publishing.'];
    }
    if (!event.flyerPath) {
      errors.flyer = ['Add a flyer before publishing.'];
    }
    if (event.interests.length === 0) {
      errors.interests = [
        'Tag at least one interest so the right people see your event.',
      ];
    }

    const now = new Date();

    for (const ticket of event.tickets) {
      if (ticket.status !== 'on_sale') {
        continue;
      }

      if (ticket.salesEndsAt !== null && ticket.salesEndsAt < now) {
        errors.tickets = [
          `Ticket "${ticket.name}" has a sales period that already ended.`,
        ];
        break;
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationFailedException(errors);
    }
  }
}
