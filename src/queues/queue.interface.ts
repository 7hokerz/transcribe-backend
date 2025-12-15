
export interface JobQueue<T> {
    enqueue(job: T): Promise<any>;
}
