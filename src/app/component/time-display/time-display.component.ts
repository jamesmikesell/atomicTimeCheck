import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';

@Component({
    selector: 'app-time-display',
    templateUrl: './time-display.component.html',
    styleUrls: ['./time-display.component.scss']
})
export class TimeDisplayComponent implements OnInit, OnDestroy {

    private localOffset: number = undefined;
    private uiUpdateTimer: Subscription;
    private periodicResyncTimer: Subscription;
    private performanceTimeOffsetAtSync: number;


    realTime: Date;
    capturedTimes: Date[] = [undefined, undefined, undefined];

    constructor(private http: HttpClient) { }

    ngOnInit(): void {
        this.calculateOffset();
    }

    ngOnDestroy(): void {
        this.cancelUpUpdater();
        this.cancelPeriodicResync();
    }

    private scheduleResync(): void {
        this.cancelPeriodicResync();
        this.periodicResyncTimer = timer(30 * 60 * 1000).subscribe(() => {
            this.calculateOffset();
        });
    }

    private scheduleScreenUpdate(delay: number): void {
        this.cancelUpUpdater();

        this.uiUpdateTimer = timer(delay).subscribe(() => {
            if (this.localOffset !== undefined) {
                // This will get triggered on either a system clock change, or if the device sleeps / wakes
                let deltaWithPerformanceSync = Math.abs((Date.now() - performance.now()) - this.performanceTimeOffsetAtSync);
                if (deltaWithPerformanceSync > 50) {
                    this.calculateOffset();
                    return;
                }

                this.realTime = this.getRealTime();

                this.scheduleScreenUpdate(1000 - this.realTime.getMilliseconds());
            }
        });
    }

    private getRealTime(): Date {
        return new Date(performance.now() + this.localOffset);
    }

    private cancelUpUpdater(): void {
        if (this.uiUpdateTimer && !this.uiUpdateTimer.closed)
            this.uiUpdateTimer.unsubscribe();
    }

    private cancelPeriodicResync(): void {
        if (this.periodicResyncTimer && !this.periodicResyncTimer.closed)
            this.periodicResyncTimer.unsubscribe();
    }

    private async calculateOffset(): Promise<void> {
        this.cancelUpUpdater();
        this.cancelPeriodicResync();
        this.localOffset = undefined;
        this.performanceTimeOffsetAtSync = undefined;
        this.realTime = undefined;

        let serverTime: number;
        let callStart: number;
        let callEnd: number;

        let serverCold = true;
        let attempts = 1;
        let successfulAttempts = 0;
        while (attempts <= 5 && (serverCold || successfulAttempts < 2)) {
            callStart = performance.now();
            let response = <ServerTime>await this.getServerResponse();
            callEnd = performance.now();

            serverTime = new Date(response.date).getTime();

            serverCold = response.serverCold;
            if (!serverCold)
                successfulAttempts++;


            attempts++;
        }

        if (!serverCold) {
            let halfFlightTime = ((callEnd - callStart) / 2);
            this.localOffset = (serverTime + halfFlightTime) - callEnd;

            this.performanceTimeOffsetAtSync = Date.now() - performance.now();

            this.scheduleScreenUpdate(0);
            this.scheduleResync();
        }
    }

    private getServerResponse(): Promise<ServerTime> {
        return this.http
            .get<ServerTime>("https://f6lxt414xb.execute-api.us-east-1.amazonaws.com/default/getTime")
            .toPromise();
    }

    captureTime(): void {
        this.capturedTimes.reverse();
        this.capturedTimes.push(this.getRealTime());
        this.capturedTimes.splice(0, 1);
        this.capturedTimes.reverse();
    }

}

interface ServerTime {
    date: string;
    serverCold: boolean;
}

