import type { ReactNode } from 'react';

type TrainingDataProviderProps = {
  children: ReactNode;
};

export default function TrainingDataProvider({
  children,
}: TrainingDataProviderProps) {
  return children;
}
