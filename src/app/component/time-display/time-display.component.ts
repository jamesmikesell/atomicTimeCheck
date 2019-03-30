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
    private timerSubscription: Subscription;
    private periodicUpdate: Subscription;

    realTime: Date;
    capturedTimes: Date[] = [undefined, undefined, undefined];

    constructor(private http: HttpClient) { }

    ngOnInit(): void {
        this.calculateOffset();

        this.periodicUpdate = timer(30 * 60 * 1000).subscribe(() => {
            this.calculateOffset();
        });
    }

    ngOnDestroy(): void {
        this.cancelTimer();
        this.cancelPeriodicUpdate();
    }


    private scheduleScreenUpdate(delay: number): void {
        this.cancelTimer();

        this.timerSubscription = timer(delay).subscribe(() => {
            if (this.localOffset !== undefined) {
                this.realTime = this.getRealTime();

                this.scheduleScreenUpdate(1000 - this.realTime.getMilliseconds());
            }
        });
    }

    private getRealTime(): Date {
        return new Date(window.performance.now() + this.localOffset);
    }

    private cancelTimer(): void {
        if (this.timerSubscription && !this.timerSubscription.closed)
            this.timerSubscription.unsubscribe();
    }

    private cancelPeriodicUpdate(): void {
        if (this.periodicUpdate && !this.periodicUpdate.closed)
            this.periodicUpdate.unsubscribe();
    }

    private async calculateOffset(): Promise<void> {
        let serverTime: number;
        let callStart: number;
        let callEnd: number;

        let serverCold = true;
        let attempts = 1;
        let successfulAttempts = 0;
        while (attempts <= 5 && (serverCold || successfulAttempts < 2)) {
            callStart = window.performance.now();
            let response = <ServerTime>await this.getServerResponse();
            callEnd = window.performance.now();

            serverTime = new Date(response.date).getTime();

            serverCold = response.serverCold;
            if (!serverCold)
                successfulAttempts++;


            attempts++;
        }

        if (!serverCold) {
            let halfFlightTime = ((callEnd - callStart) / 2);
            this.localOffset = (serverTime + halfFlightTime) - callEnd;
            this.scheduleScreenUpdate(0);
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

