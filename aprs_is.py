#!env/bin/python

import traceback
import sys

import asyncio
from asyncio import Event
from asyncio import Queue

from ax25.ax25 import AX25

from lib.utils import is_parse_args

CALL = 'KI5TOF'
PASSCODE = '17081'

APRS_IS_HOST = 'rotate.aprs.net'
APRS_IS_FULL_FEED_PORT = 10152
APRS_IS_FILTER_PORT = 14580

#APRS
#connecting: https://www.aprs-is.net/Connecting.aspx
#filters: https://www.aprs-is.net/javAPRSFilter.aspx

#position: KI5TOF>APRS:=2941.97N/09545.01WChello world
#status:   KI5TOF>APRS:>hello world!
#message:  KI5TOF>APRS::KI5TOF   :hello world
#station:  KI5TOF-1>APKI5:!2941.97N/09545.01W#PHG0009Rx only igate

#https://aprs.fi/doc/guide/aprsfi-telemetry.html
#https://github.com/PhirePhly/aprs_notes/blob/master/telemetry_format.md
#specify parameter names and units
#telem:    KI5TOF>APRS::KI5TOF   :PARM.Title_A1,Title_B2,Title_C3,Title_D4,Title_E5,BIT_A1,BIT_B2,BIT_C3,BIT_D4,BIT_E5,BIT_F6,BIT_G7,BIT_H8
#telem:    KI5TOF>APRS::KI5TOF   :UNIT.Volt,Volt,Volt,Volt,Volt,B,B,B,B,B,B,B,B
#specify scaling ax^2+bx+c             a,b,c|a,b,c|a,b,c|a,b,c|a,b,c
#telem:    KI5TOF>APRS::KI5TOF   :EQNS.0,1,0,0,1,0,0,1,0,0,1,0,0,1,0
# sending data
#telem:    KI5TOF>APRS:T#000,1,2,3,4,5,01010101
#telem:    KI5TOF>APRS:T#002,10.12,20.23,30.45,40.67,50.89,10101010
#telem:    KI5TOF>APRS:T#003,110.12,120.23,130.45,140.67,150.89,10101010comment

async def aprs_is_ingress(reader, login_evt, call):
    try:
        login_resp = 'logresp {} verified'.format(call)
        while True:
            data = await reader.read(1024)
            if data:
                # print('<<<',data)
                line = data.decode()
                if len(line) > 0:
                    if line[:7] != '# aprsc':
                        print(line.rstrip())
                    if line.find(login_resp) != -1:
                        login_evt.set()
    except asyncio.CancelledError:
        raise
    except Exception as err:
        traceback.print_exc()

async def stdin_ingress(call,
                        ax25_q,
                        ):
    try:
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader()
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)

        eol = ord('\n')
        done = False
        buf = bytearray(512)

        while not done:
            i = 0
            while True:
                try:
                    b = await reader.readexactly(1)
                except asyncio.IncompleteReadError:
                    done = True
                    break
                if ord(b) == eol:
                    break
                buf[i] = ord(b)
                i = (i+1)%512
            line = buf[:i]
            if not line:
                continue

            print('<', line.decode())
            ax25 = AX25(aprs = line)
            await ax25_q.put(ax25)

    except asyncio.CancelledError:
        raise
    except Exception as err:
        traceback.print_exc()

async def station_beacon( ax25_q,):
    try:
        beacon_ax25 = AX25(aprs='KI5TOF-1>APKI5:!2941.97N/09545.01W#PHG0009Rx only igate')
        while True:
            await ax25_q.put(beacon_ax25)
            await asyncio.sleep(60*15)
    except asyncio.CancelledError:
        raise
    except Exception as err:
        traceback.print_exc()

async def aprs_is_egress(writer, 
                         call,
                         passcode,
                         login_evt,
                         ax25_q,
                         ):
    try:
        #login
        login_str = 'user {} pass {} vers microax25afsk 0.0 filter p/{}'.format(
                    call, passcode, call)
        writer.write(login_str.encode())
        writer.write(b'\r\n')
        await writer.drain()
       
        #wait for login response
        await login_evt.wait()

        while True:
            ax25 = await ax25_q.get()
            print('>',ax25)
            writer.write(ax25.encode())
            writer.write(b'\r\n')
            await writer.drain()
            ax25_q.task_done()
    except asyncio.CancelledError:
        raise
    except Exception as err:
        traceback.print_exc()

async def main():
    args = is_parse_args(sys.argv)
    try:
        reader, writer = await asyncio.open_connection(APRS_IS_HOST, APRS_IS_FILTER_PORT)
        tasks = []
        call = args['args']['call'].upper()
        passcode = args['args']['passcode']
        login_evt = Event()
        ax25_q = Queue()

        tasks.append(asyncio.create_task(aprs_is_ingress(reader    = reader,
                                                         call      = call,
                                                         login_evt = login_evt,
                                                         )))

        tasks.append(asyncio.create_task(aprs_is_egress(writer    = writer,
                                                        call      = call,
                                                        passcode  = passcode,
                                                        login_evt = login_evt,
                                                        ax25_q    = ax25_q,
                                                        )))

        tasks.append(asyncio.create_task(stdin_ingress(call      = call,
                                                       ax25_q    = ax25_q,
                                                       )))

        tasks.append(asyncio.create_task(station_beacon( ax25_q    = ax25_q,)))

        await asyncio.gather(*tasks, return_exceptions=True)
    except asyncio.CancelledError:
        raise
    except Exception as err:
        traceback.print_exc()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass

