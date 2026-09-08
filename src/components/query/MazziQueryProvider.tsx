import React from 'react';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryClient, queryPersister, shouldPersistQuery } from '../../lib/query-client';

export const MazziQueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <PersistQueryClientProvider
    client={queryClient}
    persistOptions={{
      persister: queryPersister,
      dehydrateOptions: { shouldDehydrateQuery: shouldPersistQuery },
    }}
  >
    {children}
  </PersistQueryClientProvider>
);
