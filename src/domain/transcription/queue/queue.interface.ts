
export interface JobQueue<TIn, TOut = void> {
    enqueue(job: TIn): Promise<TOut>;
}
