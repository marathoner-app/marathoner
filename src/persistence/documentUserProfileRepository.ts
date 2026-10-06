import {
  validateUserProfile,
  type UserId,
  type UserProfile,
} from "../domain/training";
import type { DocumentStore } from "./documentStore";
import type { PersistenceClock } from "./documentTrainingRepositories";
import { PersistenceError, toPersistenceError } from "./errors";
import {
  userProfileFromDocument,
  userProfileToDocument,
} from "./firestore/converters";
import { profileDocumentPath } from "./firestore/paths";
import type {
  SaveUserProfileInput,
  UserProfileRepository,
} from "./trainingRepositories";

async function safely<Value>(operation: () => Promise<Value>): Promise<Value> {
  try {
    return await operation();
  } catch (error) {
    throw toPersistenceError(error);
  }
}

function requireValidProfile(profile: UserProfile): void {
  const issues = validateUserProfile(profile);

  if (issues.length > 0) {
    throw new PersistenceError(
      "invalid_data",
      issues.map((issue) => issue.message).join(" "),
    );
  }
}

class DocumentUserProfileRepository implements UserProfileRepository {
  constructor(
    private readonly store: DocumentStore,
    private readonly userId: UserId,
    private readonly clock: PersistenceClock,
  ) {}

  load(): Promise<UserProfile | null> {
    return safely(async () => {
      const document = await this.store.get(profileDocumentPath(this.userId));

      return document === null
        ? null
        : userProfileFromDocument(document.id, document.data, this.userId);
    });
  }

  save(input: SaveUserProfileInput): Promise<UserProfile> {
    return safely(async () => {
      const existing = await this.load();
      const now = this.clock();
      const profile: UserProfile = {
        id: this.userId,
        ...input,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      requireValidProfile(profile);
      await this.store.set(
        profileDocumentPath(this.userId),
        userProfileToDocument(profile),
      );

      return profile;
    });
  }
}

export function createDocumentUserProfileRepository(
  store: DocumentStore,
  userId: UserId,
  clock: PersistenceClock,
): UserProfileRepository {
  return new DocumentUserProfileRepository(store, userId, clock);
}
