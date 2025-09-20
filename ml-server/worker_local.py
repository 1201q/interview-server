import os
from redis import Redis
from rq import Queue
from rq.worker import SimpleWorker


REDIS_URL = os.getenv("RQ_REDIS_URL", "redis://localhost:6379/1")

import tasks


def main():
    r = Redis.from_url(REDIS_URL)
    q = Queue("audio", connection=r)
    w = SimpleWorker([q], connection=r)
    w.work(burst=False)


if __name__ == "__main__":
    main()
