
export interface JobQueue<TIn extends object, TOut = void> {
    enqueue(job: TIn): Promise<TOut>;
}
