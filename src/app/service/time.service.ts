import { Injectable } from '@angular/core';
import { Subscription, timer, interval } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
    providedIn: 'root'
})
export class TimeService {

    private localOffset: number = undefined;
    private offsetTimes: number[] = [];
    private refreshTimes: number[] = [];
    private periodicResyncTimer: Subscription;
    private largeDriftCheckTimer: Subscription;
    private performanceTimeOffsetAtSync: number;


    constructor(private http: HttpClient) {
        this.calculateOffset();
    }

    getRealTime(): Date {
        if (this.localOffset === undefined)
            return undefined;
        return new Date(performance.now() + this.localOffset);
    }

    private scheduleResync(): void {
        this.cancelPeriodicResync();
        this.periodicResyncTimer = timer(10 * 60 * 1000).subscribe(() => {
            this.calculateOffset();
        });
    }

    private cancelPeriodicResync(): void {
        if (this.periodicResyncTimer && !this.periodicResyncTimer.closed)
            this.periodicResyncTimer.unsubscribe();
    }


    private scheduleLargeDriftCheck(): void {
        this.cancelLargeDriftCheckTimer();
        this.largeDriftCheckTimer = interval(1000).subscribe(() => {
            this.checkForLargeDrifts();
        });
    }

    private cancelLargeDriftCheckTimer(): void {
        if (this.largeDriftCheckTimer && !this.largeDriftCheckTimer.closed)
            this.largeDriftCheckTimer.unsubscribe();
    }


    private checkForLargeDrifts(): void {
        // This will get triggered on either a system clock change, or if the device sleeps / wakes
        if (this.performanceTimeOffsetAtSync) {
            let deltaWithPerformanceSync = Math.abs((Date.now() - performance.now()) - this.performanceTimeOffsetAtSync);
            if (deltaWithPerformanceSync > 50) {
                console.log("Large drift detected, resyncing");
                this.calculateOffset();
            }
        }
    }


    private async calculateOffset(): Promise<void> {
        this.cancelPeriodicResync();
        this.cancelLargeDriftCheckTimer();

        let serverTime: number;
        let callStart: number;
        let callEnd: number;

        let offsets: number[] = [];
        let successfulAttempts = 0;

        while (successfulAttempts < 1) {
            let serverCold = true;
            while (serverCold) {
                callStart = performance.now();
                let response = <ServerTime>await this.getServerResponse();
                callEnd = performance.now();

                if (response.date) {
                    serverTime = new Date(response.date).getTime();
                    serverCold = response.serverCold;
                    if (!serverCold) {
                        successfulAttempts++;
                    } else {
                        console.log("server cold");
                        await this.sleep(1000);
                    }
                } else {
                    await this.sleep(10000);
                }
            }

            if (!serverCold) {
                let halfFlightTime = ((callEnd - callStart) / 2);
                let offset = (serverTime + halfFlightTime) - callEnd;

                offsets.push(offset);
            }
        }

        let avgOffset = this.getAverage(offsets);
        this.localOffset = avgOffset;
        this.offsetTimes.push(avgOffset);
        this.refreshTimes.push(callEnd);
        this.performanceTimeOffsetAtSync = Date.now() - performance.now();
        this.outputOffsetStats();


        this.scheduleResync();
        this.scheduleLargeDriftCheck();
    }

    private async sleep(msec: number): Promise<void> {
        return new Promise<void>(resolve => setTimeout(resolve, msec));
    }

    private outputOffsetStats(): void {
        if (this.offsetTimes.length > 0) {
            let min = this.offsetTimes[0];
            let max = this.offsetTimes[0];
            for (let i = 0; i < this.offsetTimes.length; i++) {
                const time = this.offsetTimes[i];
                min = Math.min(time, min);
                max = Math.max(max, time);
            }

            let average = this.getAverage(this.offsetTimes);
            let squaredDiffs = this.offsetTimes.map(time => Math.pow(time - average, 2));
            let stdDeviation = Math.sqrt(this.getAverage(squaredDiffs));

            let maxDeviationFromAvg = Math.max(average - min, max - average);

            console.log(Math.round(max - min),
                Math.round(min),
                Math.round(max),
                Math.round(average),
                Math.round(maxDeviationFromAvg),
                Math.round(stdDeviation * 10) / 10);


            if (this.offsetTimes.length >= 2) {
                let first = this.offsetTimes[0];
                let last = this.offsetTimes[this.offsetTimes.length - 1];

                let localTimeDurationMinutes = (this.refreshTimes[this.refreshTimes.length - 1] - this.refreshTimes[0]) / 60 / 1000;

                let dif = last - first;
                let drift = dif / localTimeDurationMinutes;
                console.log(drift);
            }

        }
    }

    private getAverage(values: number[]): number {
        return values.reduce((a, b) => a + b) / values.length;
    }

    private getServerResponse(): Promise<ServerTime> {
        return this.http
            .get<ServerTime>("https://f6lxt414xb.execute-api.us-east-1.amazonaws.com/default/getTime")
            .toPromise().catch(er => {
                console.log("Error talking to server", er);

                return {
                    date: undefined,
                    serverCold: true
                } as ServerTime;
            });
    }

}



interface ServerTime {
    date: string;
    serverCold: boolean;
}
