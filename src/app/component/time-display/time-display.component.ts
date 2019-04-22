import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { TimeService } from '../../service/time.service';

@Component({
    selector: 'app-time-display',
    templateUrl: './time-display.component.html',
    styleUrls: ['./time-display.component.scss']
})
export class TimeDisplayComponent implements OnInit, OnDestroy {

    private uiUpdateTimer: Subscription;

    realTime: Date;
    capturedTimes: Date[] = [undefined, undefined, undefined];

    constructor(private timeService: TimeService) { }

    ngOnInit(): void {
        this.scheduleScreenUpdate(0);
    }

    ngOnDestroy(): void {
        this.cancelUiUpdater();
    }

    private scheduleScreenUpdate(delay: number): void {
        this.cancelUiUpdater();

        this.uiUpdateTimer = timer(delay).subscribe(() => {
            let realTime = this.timeService.getRealTime();
            if (realTime !== undefined) {
                this.realTime = realTime;
                this.scheduleScreenUpdate(1000 - this.realTime.getMilliseconds());
            } else {
                this.realTime = undefined;
                this.scheduleScreenUpdate(500);
            }
        });
    }


    private cancelUiUpdater(): void {
        if (this.uiUpdateTimer && !this.uiUpdateTimer.closed)
            this.uiUpdateTimer.unsubscribe();
    }


    captureTime(): void {
        this.capturedTimes.reverse();
        this.capturedTimes.push(this.timeService.getRealTime());
        this.capturedTimes.splice(0, 1);
        this.capturedTimes.reverse();
    }

}
