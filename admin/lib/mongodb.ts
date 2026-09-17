import { MongoClient, type Db } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'telegram_air_admin';

type MongoCache = {
  client?: MongoClient;
  promise?: Promise<MongoClient>;
};

const globalForMongo = globalThis as typeof globalThis & { __airMongo?: MongoCache };

const cache = globalForMongo.__airMongo ?? {};
globalForMongo.__airMongo = cache;

async function getClient() {
  if (cache.client) {
    return cache.client;
  }

  if (!cache.promise) {
    const client = new MongoClient(uri);
    cache.promise = client.connect().then((connected) => {
      cache.client = connected;
      return connected;
    });
  }

  return cache.promise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}
