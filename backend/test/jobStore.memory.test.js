import { memoryJobStore } from './helpers/memoryJobStore.js';
import { jobStoreContract } from './helpers/jobStoreContract.js';

let n = 0;
jobStoreContract('memory store', { makeStore: () => memoryJobStore(), makeId: () => `id${++n}` });
