import { useMutation } from '@tanstack/react-query';
import { triggerInvestigation } from '../services/api';

export const useInvestigation = () => {
  return useMutation({
    mutationFn: ({ userId, context }: { userId?: string, context?: string }) => triggerInvestigation(userId, context),
  });
};
