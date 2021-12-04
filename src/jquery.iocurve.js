(function($){
    'use strict';

    var PI_HALF = Math.PI / 2;
    var PIx2 = Math.PI * 2;

    // Math.cos(90度)がゼロにならない誤差対策
    function Math_cos(x){
        return x ? x % PI_HALF ? Math.cos(x) : 0 : 1;
    }

    $.fn.iocurve = function( input_option ){
        this.each(function(){
            var option = {
                // 入出力値の範囲と分解幅
                x: [0, 255],
                y: [0, 255],
                dx: 1,
                // Y軸のゼロ
                y0: 0,
                // 曲率
                curvature: 0.3,
                // 本体クラス名
                className: '',
                // 本体CSS
                css: {
                    position: 'relative',
                    margin: '20px'
                },
                // キャンバス
                canvas: {
                    height: '100%', // ピクセルまたは%
                    fillStyle: '#fff',
                    css: {
                        display: 'block',
                        boxShadow: '0 0 3px #000'
                    }
                },
                // 補助目盛線
                grid: {
                    visible: true,
                    strokeStyle: 'rgba(0, 0, 0, 0.2)'
                },
                // アンカー
                anchor: {
                    points: [ [0, 0], [255, 255] ],
                    tagName: 'a',
                    className: 'anchor',
                    css: {
                        position: 'absolute',
                        display: 'block',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: '1px solid rgba(0, 0, 0, 0.5)',
                        background: 'rgba(255, 255, 255, 0.5)',
                        boxSizing: 'border-box',
                        cursor: 'move',
                        transform: 'translate(-50%, -50%)'
                    }
                },
                // 棒グラフ
                bar: {
                    visible: true,
                    fillStyle: {
                        positive: 'rgba(0, 100, 70, 0.2)',
                        negative: 'rgba(150, 30, 70, 0.2)'
                    }
                },
                // 散布図
                plot: {
                    visible: false,
                    strokeStyle: '#f00'
                },
                // ヒストグラム
                histogram: {
                    data: null,
                    fillStyle: '#ddd'
                },
                // 制御点（接線）
                controlPoint: {
                    visible: false,
                    strokeStyle: '#00f'
                }
            };
            $.extend(true, option, input_option);
            main.call( this, option );
        });
        return this;
    };

    function main( option ){
        var $container = $(this);
        var $content = $(document.createElement('div'));
        var $anchors = $();
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        var anchorX = [];
        var anchorY = [];
        var outputY = [];
        var outCX = [];
        var outCY = [];
        var cp1NX = [];
        var cp1NY = [];
        var cp2NX = [];
        var cp2NY = [];
        var rangeX;
        var rangeY;
        var countX;
        var curve_dx;
        var to_canvasX;
        var to_canvasY;
        var VW;
        var VH;

        $content.append(canvas).appendTo($container);
        $container.on('mousedown', onMousedown);
        $container.on('data', onData);
        $container.on('option', onOption);
        $container.on('resized', onResized);
        $container.on('destroy', onDestroy);

        OptionInit();
        CanvasResize();
        AnchorCreate();
        Draw();

        // ---------------------------------------------------------
        // アンカー移動・追加
        // ---------------------------------------------------------
        function onMousedown(ev){
            if( 1 < ev.which ) return;
            var $target = $(ev.target);
            if( !$target.closest(this).length ) return;
            var $anc, index;
            if( $target.hasClass(option.anchor.className) ){
                // アンカー移動
                index = $anchors.index(ev.target);
                if( index < 0 ) return;
                $anc = $anchors.eq(index);
            }
            else{
                // アンカー追加
                var offset = $content.offset();
                var x = ev.pageX - offset.left;
                var y = ev.pageY - offset.top;
                $anchors.each(function(i){
                    var left = parseFloat(this.style.left);
                    if( left < x ) index = i + 1;
                    else return false;
                });
                if( index && index < $anchors.length ){
                    var prevLeft = parseFloat($anchors[index-1].style.left);
                    var nextLeft = parseFloat($anchors[index].style.left);
                    x = Math.min(Math.max(prevLeft, x), nextLeft);
                    if( x === prevLeft || x === nextLeft ) return;
                    y = Math.min(Math.max(y, 0), VW);
                    $anc = $newAnchor(x, y).insertBefore($anchors.eq(index));
                    $anchors = $content.find('.' + option.anchor.className);
                    fireAnchor($anc, 'new');
                    Draw();
                }
                else return;
            }
            var down = {
                x: ev.pageX,
                y: ev.pageY,
                left: parseFloat($anc.css('left')),
                top: parseFloat($anc.css('top'))
            };
            $(document).one('mouseup', onMouseup);
            $(document).on('mousemove', onMousemove);
            ev.preventDefault();

            function onMouseup(){
                $(document).off('mousemove', onMousemove);
            }
            function onMousemove(ev){
                var dX = ev.pageX - down.x;
                var dY = ev.pageY - down.y;
                var left = Math.min(Math.max(down.left + dX, 0), VW);
                var top = Math.min(Math.max(down.top + dY, 0), VH);
                // 移動範囲制限
                if( index === 0 ) left = 0;
                else if( index === $anchors.length-1 ) left = VW;
                else{
                    var prev = $anchors[index-1];
                    var next = $anchors[index+1];
                    var prevLeft = parseFloat(prev.style.left);
                    var nextLeft = parseFloat(next.style.left);
                    var prevTop = parseFloat(prev.style.top);
                    var nextTop = parseFloat(next.style.top);
                    left = Math.min(Math.max(left, prevLeft), nextLeft);
                    // アンカー削除
                    if( close2prev() || close2next() ){
                        onMouseup();
                        fireAnchor($anc, 'remove');
                        $anc.remove();
                        $anchors = $content.find('.' + option.anchor.className);
                        Draw();
                        return;
                    }
                }
                $anc.css('left', left);
                $anc.css('top', top);
                $anc.data('p', offset2real(left, top));
                fireAnchor($anc, 'move');
                Draw();

                function close2prev(){
                    var dx = Math.abs(left - prevLeft);
                    var dy = Math.abs(top - prevTop);
                    return dx + dy < 6;
                }
                function close2next(){
                    var dx = Math.abs(left - nextLeft);
                    var dy = Math.abs(top - nextTop);
                    return dx + dy < 6;
                }
            }
        }

        // ---------------------------------------------------------
        // [イベント]アンカー入力
        // $container.on('anchor', function( ev, anchor ){
        //     // anchor.element   anchor DOM element
        //     // anchor.kind      'new'|'move'|'remove'
        //     // anchor.x         coordinate X
        //     // anchor.y         coordinate Y
        // });
        // ---------------------------------------------------------
        function fireAnchor( $anchor, kind ){
            var p = $anchor.data('p');
            var anchor = {
                element: $anchor[0],
                kind: kind,
                x: p[0],
                y: p[1]
            };
            $container.trigger('anchor', [anchor]);
        }

        // ---------------------------------------------------------
        // [イベント]出力データ更新
        // $container.on('output', function( ev, data ){
        //     // data is array of output value
        // });
        // ---------------------------------------------------------
        function fireOutput(){
            $container.trigger('output', [outputY]);
        }

        // ---------------------------------------------------------
        // [メソッド]出力値を取得
        // $container.trigger('data', [function( data ){
        //     // data
        // }]);
        // ---------------------------------------------------------
        function onData( ev, callback ){
            callback.call(this, outputY);
            return false;
        }

        // ---------------------------------------------------------
        // [メソッド]オプション変更
        // $container.trigger('option', [{
        //     // 任意のオプション
        //     // ただし anchor.points は変更不可
        // }]);
        // ---------------------------------------------------------
        function onOption( ev, input_option ){
            $.extend(true, option, input_option);
            OptionInit();
            CanvasResize();
            AnchorReset();
            Draw();
            return false;
        }

        // ---------------------------------------------------------
        // [メソッド]リサイズ
        // $container.trigger('resized');
        // ---------------------------------------------------------
        function onResized(){
            CanvasResize();
            $anchors.each(function(){
                var p = $(this).data('p');
                $(this).css(real2offset(p))
            });
            Draw();
            return false;
        }

        // ---------------------------------------------------------
        // [メソッド]破棄
        // $container.trigger('destroy');
        // ---------------------------------------------------------
        function onDestroy(){
            $container.off('mousedown', onMousedown);
            $container.off('data', onData);
            $container.off('option', onOption);
            $container.off('resized', onResized);
            $container.off('destroy', onDestroy);
            $content.remove();
        }

        // オプションから決まる固定値
        function OptionInit(){
            rangeX = option.x[1] - option.x[0];
            rangeY = option.y[1] - option.y[0];
            countX = Math.floor(rangeX / option.dx) + 1;
            // 曲線分割少なくとも全体100以上
            curve_dx = (option.dx * 100 < rangeX) ? option.dx / rangeX : 0.01;
            // CSS他
            $.each(option.canvas.css, function(name, value){
                canvas.style[name] = value;
            });
            $content.addClass(option.className).css(option.css)
        }

        // キャンバス大きさ
        function CanvasResize(){
            canvas.width = 0;
            VW = $content.width() || $container.width();
            VH = /%/.test(option.canvas.height) ? VW * parseFloat(option.canvas.height) / 100 : option.canvas.height;
            canvas.width = VW * (window.devicePixelRatio || 1);
            canvas.height = VH * (window.devicePixelRatio || 1);
            canvas.style.width = VW + 'px';
            canvas.style.height = VH + 'px';
            to_canvasX = canvas.width / rangeX;
            to_canvasY = canvas.height / rangeY;
            // スクロールバー有無で親要素の幅が変わった時はリサイズリトライ
            setTimeout(function(){
                if( $content.width() < VW - 1 ) onResized();
            }, 0);
        }

        // アンカー生成
        function AnchorCreate(){
            var po = option.anchor.points;
            for( var i=0; i<po.length; i++ ){
                var of = real2offset(po[i]);
                var $a = $newAnchor(of.left, of.top);
                $anchors = $anchors.add($a);
            }
            $anchors.appendTo($content);
        }

        // アンカーリセット
        function AnchorReset(){
            for( var i=$anchors.length; i--; ){
                var $a = $anchors.eq(i);
                var left = parseFloat($a.css('left'));
                var top = parseFloat($a.css('top'));
                $a.data('p', offset2real(left, top));
            }
        }

        // 描画
        function Draw(){
            Interpolate();
            DrawBackground();
            if( option.histogram.data ) DrawHistogram();
            if( option.grid.visible ) DrawGrid();
            if( option.bar.visible ) DrawBar();
            if( option.plot.visible ) DrawPlot();
            if( option.controlPoint.visible && cp1NX.length ) DrawControlPoints();
            return false;
        }

        // 背景描画
        function DrawBackground(){
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = option.canvas.fillStyle;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // 補助線描画
        function DrawGrid(){
            ctx.strokeStyle = option.grid.strokeStyle;
            DrawLine1(
                canvas.width / 2 + 0.5,
                0,
                canvas.width / 2 + 0.5,
                canvas.height
            );
            DrawLine1(
                0,
                canvas.height / 2 + 0.5,
                canvas.width,
                canvas.height / 2 + 0.5
            );
        }

        // 補間
        function Interpolate(){
            var anchorNX = [];  // 正規化アンカーX座標
            var anchorNY = [];  // 正規化アンカーY座標
            var lengths = [];   // アンカー接線(ベジェ制御点)長さ係数
            var angles = [];    // アンカー接線の傾き
            var outNX = [];     // 補間曲線X座標
            var outNY = [];     // 補間曲線Y座標
            var animax = $anchors.length - 1;
            var isLineOnly = $anchors.length < 3 || option.curvature <= 0;
            anchorX.length = anchorY.length = 0;
            cp1NX.length = cp1NY.length = 0;
            cp2NX.length = cp2NY.length = 0;
            // -------------------------------------------------------------------
            // アンカー座標取得＋正規化(0～1)
            // -------------------------------------------------------------------
            for( var i=0; i<$anchors.length; i++ ){
                var p = $anchors.eq(i).data('p');
                var x = p[0];
                var y = p[1];
                var nx = (x - option.x[0]) / rangeX;
                var ny = (y - option.y[0]) / rangeY;
                anchorX[i] = x;
                anchorY[i] = y;
                anchorNX[i] = nx;
                anchorNY[i] = ny;
                if( i ){
                    var dx = nx - anchorNX[i-1];
                    var dy = ny - anchorNY[i-1];
                    var len = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
                    lengths[i-1] = len * option.curvature;
                }
            }
            if( isLineOnly ) return LineInterpolate(anchorNX, anchorNY);
            // -------------------------------------------------------------------
            // アンカー2点目～末尾前の接線の傾きとベジェ制御点
            // ・自身が前後アンカーのちょうど真ん中にある時は、単純に前後アンカーを通る直線の傾きとなる。
            // ・前後どちらかに近い場合は、近いほどそのアンカーと自身を通る直線の傾きに近づけていく。
            // ・たとえば前のアンカーにかなり近い時は、自身と前のアンカーを通る直線の傾きにかなり近くなる。
            // -------------------------------------------------------------------
            for( var i=1; i<animax; i++ ){
                // 接線の傾き
                angles[i] = anchor_tangent_angle(
                    anchorNX[i+1] - anchorNX[i-1],
                    anchorNY[i+1] - anchorNY[i-1],
                    anchorNX[i] - anchorNX[i-1],
                    anchorNY[i] - anchorNY[i-1],
                    anchorNX[i+1] - anchorNX[i],
                    anchorNY[i+1] - anchorNY[i]
                );
                // ベジェ制御点
                anchor_control_point(
                    i,
                    anchorNX[i],
                    anchorNY[i],
                    lengths[i-1],
                    lengths[i],
                    angles[i]
                );
            }
            function anchor_tangent_angle( dx, dy, dx1, dy1, dx2, dy2, l1, l2, ratio ){
                // 前後の点との距離
                l1 = Math.pow(dx1, 2) + Math.pow(dy1, 2);
                l2 = Math.pow(dx2, 2) + Math.pow(dy2, 2);
                // 前のアンカーに近い
                if( l1 < l2 ){
                    ratio = l1 / l2;
                    return ratio * Math.atan2(dy, dx) + (1 - ratio) * Math.atan2(dy1, dx1);
                }
                // 後のアンカーに近い
                if( l2 < l1 ){
                    ratio = l2 / l1;
                    return ratio * Math.atan2(dy, dx) + (1 - ratio) * Math.atan2(dy2, dx2);
                }
                // ちょうど真ん中
                return Math.atan2(dy, dx);
            }
            function anchor_control_point( i, nx, ny, f1, f2, rd ){
                var cp1x = nx - Math_cos(rd) * f1;
                var cp1y = ny - Math.sin(rd) * f1;
                var cp2x = nx + Math_cos(rd) * f2;
                var cp2y = ny + Math.sin(rd) * f2;
                // 枠外にはみ出た制御点を枠内に収める
                // ・Y方向にはみ出た場合のみ処理する
                // ・X方向は後で「隣接制御点の順番(X座標)が逆転しないよう調整」されるのでここでは放置
                // ・単純に0～1の範囲内に丸めると、座標が元の接線上から外れる、つまり接線の傾きが変わるので
                // ・傾きを再計算する共に、反対側の制御点座標も新しい傾きにあわせて計算し直す
                if( cp1y < 0 || 1 < cp1y ){
                    // 丸め
                    cp1x = Math.min(Math.max(cp1x, 0), 1);
                    cp1y = Math.min(Math.max(cp1y, 0), 1);
                    // 傾き再計算
                    rd = angles[i] = Math.atan2(ny - cp1y, nx - cp1x);
                    // 反対側の制御点座標も再計算
                    cp2x = nx + Math_cos(rd) * f2;
                    cp2y = ny + Math.sin(rd) * f2;
                }
                if( cp2y < 0 || 1 < cp2y ){
                    cp2x = Math.min(Math.max(cp2x, 0), 1);
                    cp2y = Math.min(Math.max(cp2y, 0), 1);
                    rd = angles[i] = Math.atan2(cp2y - ny, cp2x - nx);
                    cp1x = nx - Math_cos(rd) * f1;
                    cp1y = ny - Math.sin(rd) * f1;
                }
                cp1NX[i] = cp1x;
                cp1NY[i] = cp1y;
                cp2NX[i] = cp2x;
                cp2NY[i] = cp2y;
            }
            // 先頭アンカーの接線の傾きとベジェ制御点1つ
            (function(){
                var n1x = anchorNX[0];
                var n1y = anchorNY[0];
                var n2x = anchorNX[1];
                var n2y = anchorNY[1];
                var n2a = angles[1];
                var x, y, _x, _y;
                // 接線の傾き
                if( n1y === n2y ){
                    _x = n2x - Math_cos(n2a);
                    x = (n1x + n2x) / 2;
                    x = x - (_x - x);
                    y = n2y - Math.sin(n2a);
                }
                else{
                    // ①1点目と2点目の中点を通り直交する直線 y = ax + b とその角度θ
                    var a = (n1x - n2x) / (n2y - n1y);
                    var b = ((n1y + n2y) / 2) - a * ((n1x + n2x) / 2);
                    var t = Math.atan(a) * 2;
                    // ②その直線に対する、2点目の接線上の適当な点の対称点
                    var sin2t = Math.sin(t);
                    var cos2t = Math_cos(t);
                    _x = n2x - Math_cos(n2a);
                    _y = n2y - Math.sin(n2a) - b;
                    x = cos2t * _x + sin2t * _y;
                    y = sin2t * _x - cos2t * _y + b;
                }
                // ③1点目から②点を結ぶ直線が1点目の接線
                var dx = x - n1x;
                var dy = y - n1y;
                var n1a = Math.atan2(dy, dx);
                if( n1a < -PI_HALF || PI_HALF < n1a ) n1a = (n1y < n2y) ? PI_HALF : -PI_HALF;
                angles[0] = n1a;
                // ベジェ制御点
                var len = lengths[0];
                var cpx = n1x + Math_cos(n1a) * len;
                var cpy = n1y + Math.sin(n1a) * len;
                // 枠外にはみ出た制御点を枠内に収める
                cpx = Math.min(Math.max(cpx, 0), 1);
                cpy = Math.min(Math.max(cpy, 0), 1);
                cp2NX[0] = cpx;
                cp2NY[0] = cpy;
            })();
            // 末尾アンカーの接線の傾きとベジェ制御点1つ
            (function(){
                var n1x = anchorNX[animax-1];
                var n1y = anchorNY[animax-1];
                var n1a = angles[animax-1];
                var n2x = anchorNX[animax];
                var n2y = anchorNY[animax];
                var x, y, _x, _y;
                // 接線の傾き
                if( n1y === n2y ){
                    _x = n1x + Math_cos(n1a);
                    x = (n1x + n2x) / 2;
                    x = x + (x - _x);
                    y = n1y + Math.sin(n1a);
                }
                else{
                    // ①末尾とその前の中点を通り直交する直線 y = ax + b とその角度θ
                    var a = (n1x - n2x) / (n2y - n1y);
                    var b = ((n1y + n2y) / 2) - a * ((n1x + n2x) / 2);
                    var t = Math.atan(a) * 2;
                    // ②その直線に対する、末尾1つ前の接線上の適当な点の対称点
                    var sin2t = Math.sin(t);
                    var cos2t = Math_cos(t);
                    _x = n1x + Math_cos(n1a);
                    _y = n1y + Math.sin(n1a) - b;
                    x = cos2t * _x + sin2t * _y;
                    y = sin2t * _x - cos2t * _y + b;
                }
                // ③末尾から②点を結ぶ直線が1点目の接線
                var dx = n2x - x;
                var dy = n2y - y;
                var n2a = Math.atan2(dy, dx);
                if( n2a < -PI_HALF || PI_HALF < n2a ) n2a = (n1y < n2y) ? PI_HALF : -PI_HALF;
                angles[animax] = n2a;
                // ベジェ制御点
                var len = lengths[animax-1];
                var cpx = n2x - Math_cos(n2a) * len;
                var cpy = n2y - Math.sin(n2a) * len;
                // 枠外にはみ出た制御点を枠内に収める
                cpx = Math.min(Math.max(cpx, 0), 1);
                cpy = Math.min(Math.max(cpy, 0), 1);
                cp1NX[animax] = cpx;
                cp1NY[animax] = cpy;
            })();
            // -------------------------------------------------------------------
            // 先頭からアンカー2点ずつ細かくベジェ曲線上の点を算出し、最後は直線補間
            // -------------------------------------------------------------------
            outNX.push(anchorNX[0]);
            outNY.push(anchorNY[0]);
            for( var i=0; i<animax; i++ ) canvas_bezier_point(
                anchorNX[i],
                anchorNY[i],
                anchorNX[i+1],
                anchorNY[i+1],
                cp2NX[i],
                cp2NY[i],
                cp1NX[i+1],
                cp1NY[i+1]
            );
            function canvas_bezier_point( p1x, p1y, p2x, p2y, cp1x, cp1y, cp2x, cp2y ){
                if( cp2x < cp1x ) cpx_reverse_fix();
                var dN = Math.floor((p2x - p1x) / curve_dx);
                for( var j=1; j<dN; j++ ){
                    var po = cubicBezierPoint2D(p1x, p1y, p2x, p2y, cp1x, cp1y, cp2x, cp2y, j / dN);
                    var px = Math.min(Math.max(po[0], 0), 1);
                    var py = Math.min(Math.max(po[1], 0), 1);
                    outNX.push(px);
                    outNY.push(py);
                }
                outNX.push(p2x);
                outNY.push(p2y);
                // 隣接する制御点の順番(X座標)逆転しないよう調整
                function cpx_reverse_fix(){
                    // アンカーX座標の中央
                    var center = (p1x + p2x) / 2;
                    // 右の方が短いので左をカット
                    if( center <= cp2x ){
                        cp1y = YforXonLinePoints( cp2x, p1x, p1y, cp1x, cp1y ) || cp1y;
                        cp1x = cp2x;
                        cp2NX[i] = cp1x;
                        cp2NY[i] = cp1y;
                        return;
                    }
                    // 左の方が短いので右をカット
                    if( cp1x <= center ){
                        cp2y = YforXonLinePoints( cp1x, p2x, p2y, cp2x, cp2y ) || cp2y;
                        cp2x = cp1x;
                        cp1NX[i+1] = cp2x;
                        cp1NY[i+1] = cp2y;
                        return;
                    }
                    // 両者とも中央を超えてるので中央に
                    cp1y = YforXonLinePoints( center, p1x, p1y, cp1x, cp1y ) || cp1y;
                    cp2y = YforXonLinePoints( center, p2x, p2y, cp2x, cp2y ) || cp2y;
                    cp1x = cp2x = center;
                    cp2NX[i] = cp1x;
                    cp2NY[i] = cp1y;
                    cp1NX[i+1] = cp2x;
                    cp1NY[i+1] = cp2y;
                }
            }
            // 細かいベジェ座標を直線補間
            return LineInterpolate(outNX, outNY);
        }

        // 直線補間 y = ax + b
        function LineInterpolate( NX, NY ){
            var ni = NX.length - 2;
            var to_x = 1 / (countX - 1);
            var a, b;
            ab();
            for( var i=countX; i--; ){
                var x = i * to_x;
                if( x < NX[ni] ){
                    while( x < NX[ni] ) ni--;
                    ab();
                }
                var y = a * x + b;
                var rx = n2realX(x);
                var ry = n2realY(y);
                outCX[i] = canvasX(rx);
                outCY[i] = canvasY(ry);
                outputY[i] = ry;
            }
            function ab(){
                var dx = NX[ni+1] - NX[ni];
                if( dx ){
                    a = (NY[ni+1] - NY[ni]) / dx;
                    b = NY[ni] - a * NX[ni];
                    return;
                }
                a = 0;
                b = NY[ni];
            }
            fireOutput();
        }

        // 出力データ棒グラフ
        function DrawBar(){
            var bar_width = ctx.canvas.width * option.dx / rangeX;
            var bar_width_half = bar_width / 2;
            var cy0 = canvasY(option.y0);
            for( var i=countX; i--; ){
                var cx = outCX[i];
                var cy = outCY[i];
                if( outputY[i] < 0 ){
                    ctx.fillStyle = option.bar.fillStyle.negative;
                    ctx.fillRect(cx - bar_width_half, cy0, bar_width, cy - cy0);
                }
                else{
                    ctx.fillStyle = option.bar.fillStyle.positive;
                    ctx.fillRect(cx - bar_width_half, cy, bar_width, cy0 - cy);
                }
            }
        }

        // 出力データ散布図プロット
        // TODO:arcだと重くなる
        function DrawPlot(){
            // ctx.strokeStyle = option.plot.strokeStyle;
            ctx.fillStyle = option.plot.strokeStyle;
            for( var i=countX; i--; ){
                // ctx.beginPath();
                // ctx.arc(outCX[i], outCY[i], 4, 0, PIx2, false);
                // ctx.stroke();
                // ctx.closePath();
                ctx.fillRect(outCX[i] - 2, outCY[i] - 2, 4, 4);
            }
        }

        // アンカー接線(ベジェ制御点)描画
        function DrawControlPoints(){
            ctx.strokeStyle = option.controlPoint.strokeStyle;
            for( var i=anchorX.length - 1; i--; ){
                DrawLine1(
                    canvasX(anchorX[i]),
                    canvasY(anchorY[i]),
                    canvasX(n2realX(cp2NX[i])),
                    canvasY(n2realY(cp2NY[i]))
                );
                DrawLine1(
                    canvasX(anchorX[i+1]),
                    canvasY(anchorY[i+1]),
                    canvasX(n2realX(cp1NX[i+1])),
                    canvasY(n2realY(cp1NY[i+1]))
                );
            }
        }

        // ヒストグラム描画
        function DrawHistogram(){
            ctx.fillStyle = option.histogram.fillStyle;
            var bar_width = ctx.canvas.width * option.dx / rangeX;
            var bar_width_half = bar_width / 2;
            for( var i=countX; i--; ){
                var cx = outCX[i];
                var cy = (1 - option.histogram.data[i]) * ctx.canvas.height;
                ctx.fillRect(cx - bar_width_half, cy, bar_width, ctx.canvas.height - cy);
            }
        }

        // 線分描画
        function DrawLine1( x1, y1, x2, y2 ){
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.closePath();
        }

        // アンカー１つ生成
        function $newAnchor( left, top ){
            var $a = $(document.createElement(option.anchor.tagName));
            $a.addClass(option.anchor.className);
            $a.css(option.anchor.css);
            $a.css('left', left);
            $a.css('top', top);
            $a.data('p', offset2real(left, top));
            return $a;
        }

        // ピクセル座標left,topを実座標に変換(ピクセルは左上原点、実座標は左下原点)
        function offset2real( left, top ){
            return [
                option.x[0] + left * rangeX / VW,
                option.y[0] + (VH - top) * rangeY / VH
            ];
        }

        // 実座標をピクセル座標left,topに変換
        function real2offset( p ){
            return {
                left: (p[0] - option.x[0]) * VW / rangeX,
                top: (rangeY - (p[1] - option.y[0])) * VH / rangeY
            };
        }

        // 正規化した座標値を元に戻す
        function n2realX(x){ return x * rangeX + option.x[0]; }
        function n2realY(y){ return y * rangeY + option.y[0]; }

        // 実XY値からキャンバス座標に
        function canvasX(x){ return (x - option.x[0]) * to_canvasX; }
        function canvasY(y){ return (option.y[1] - y) * to_canvasY; }
    }

    // 3次ベジェ曲線上の1点を求める
    // http://hakuhin.jp/as/curve.html#CURVE_01
    // http://devmag.org.za/2011/04/05/bzier-curves-a-tutorial/
    function cubicBezierPoint2D( p1x, p1y, p2x, p2y, cp1x, cp1y, cp2x, cp2y, t ){
        var u = 1 - t;
        var tt = t * t;
        var uu = u * u;
        var ttt = tt * t;
        var uuu = uu * u;
        var uut3 = 3 * uu * t;
        var utt3 = 3 * u * tt;
        var x = uuu * p1x + uut3 * cp1x + utt3 * cp2x + ttt * p2x;
        var y = uuu * p1y + uut3 * cp1y + utt3 * cp2y + ttt * p2y;
        return [ x, y ];
    }

    // 2点を通る直線上のX座標に対するY座標を求める
    function YforXonLinePoints( x, x1, y1, x2, y2 ){
        var dx = x2 - x1;
        var dy = y2 - y1;
        var a = dy / dx;
        var b = y1 - a * x1;
        return a * x + b;
    }

})(jQuery);
