import {
  type Card,
  type Grade,
  Rating,
  State,
  dateDiffInDays,
  fsrs,
  generatorParameters,
} from 'ts-fsrs';
import {
  Flashcard,
  FlashcardState,
} from '../../typeorm/entities/Flashcard.entity';
import { FlashcardRating } from '../../typeorm/entities/FlashcardReview.entity';

// Next review when the chance of recalling a card drops to 90%.
const DESIRED_RETENTION = 0.9;

// New cards a user starts per UTC day, so adding many at once doesn't flood the review.
export const MAX_NEW_CARDS_PER_DAY = 20;

// Fuzz spreads cards learned together over nearby days.
const scheduler = fsrs(
  generatorParameters({
    request_retention: DESIRED_RETENTION,
    enable_fuzz: true,
  }),
);

export type FlashcardMemory = Pick<
  Flashcard,
  | 'due'
  | 'state'
  | 'stability'
  | 'difficulty'
  | 'scheduledDays'
  | 'learningSteps'
  | 'reps'
  | 'lapses'
  | 'lastReviewedAt'
>;

export interface ReviewOutcome {
  memory: FlashcardMemory;
  log: {
    state: FlashcardState;
    stability: number;
    difficulty: number;
    elapsedDays: number;
    scheduledDays: number;
  };
}

const GRADES: Record<FlashcardRating, Grade> = {
  [FlashcardRating.AGAIN]: Rating.Again,
  [FlashcardRating.HARD]: Rating.Hard,
  [FlashcardRating.GOOD]: Rating.Good,
  [FlashcardRating.EASY]: Rating.Easy,
};

const TO_FSRS_STATE: Record<FlashcardState, State> = {
  [FlashcardState.NEW]: State.New,
  [FlashcardState.LEARNING]: State.Learning,
  [FlashcardState.REVIEW]: State.Review,
  [FlashcardState.RELEARNING]: State.Relearning,
};

const FROM_FSRS_STATE: Record<State, FlashcardState> = {
  [State.New]: FlashcardState.NEW,
  [State.Learning]: FlashcardState.LEARNING,
  [State.Review]: FlashcardState.REVIEW,
  [State.Relearning]: FlashcardState.RELEARNING,
};

// ts-fsrs derives elapsed days from last_review; its elapsed_days field is deprecated.
const toFsrsCard = (memory: FlashcardMemory): Card => ({
  due: memory.due,
  stability: memory.stability,
  difficulty: memory.difficulty,
  elapsed_days: 0,
  scheduled_days: memory.scheduledDays,
  learning_steps: memory.learningSteps,
  reps: memory.reps,
  lapses: memory.lapses,
  state: TO_FSRS_STATE[memory.state],
  last_review: memory.lastReviewedAt ?? undefined,
});

const fromFsrsCard = (card: Card): FlashcardMemory => ({
  due: card.due,
  state: FROM_FSRS_STATE[card.state],
  stability: card.stability,
  difficulty: card.difficulty,
  scheduledDays: card.scheduled_days,
  learningSteps: card.learning_steps,
  reps: card.reps,
  lapses: card.lapses,
  lastReviewedAt: card.last_review ?? null,
});

// When the card would be due next for each rating, to show under each button.
export function previewReview(
  memory: FlashcardMemory,
  now: Date,
): Record<FlashcardRating, Date> {
  const preview = scheduler.repeat(toFsrsCard(memory), now);
  return Object.fromEntries(
    Object.values(FlashcardRating).map((rating) => [
      rating,
      preview[GRADES[rating]].card.due,
    ]),
  ) as Record<FlashcardRating, Date>;
}

export function applyReview(
  memory: FlashcardMemory,
  rating: FlashcardRating,
  now: Date,
): ReviewOutcome {
  const { card, log } = scheduler.next(toFsrsCard(memory), now, GRADES[rating]);
  return {
    memory: fromFsrsCard(card),
    log: {
      state: FROM_FSRS_STATE[log.state],
      stability: log.stability,
      difficulty: log.difficulty,
      elapsedDays: memory.lastReviewedAt
        ? dateDiffInDays(memory.lastReviewedAt, now)
        : 0,
      scheduledDays: log.scheduled_days,
    },
  };
}
