(function($) {
	$(document).ready(function () {
		$(".entry-content").fitVids();
		toggleBlock();
		toTheTop();
		siteLayout();
		fadeMasthead();
		waypointRules();
		$(window).resize(function() {			//rules for when things get resized
			siteLayout();
			fadeMasthead();
			waypointRules();
		});
	});

	//Menu display
	function toggleBlock(options) {
		var settings = $.extend({
			buttonID	:	'#menu-button',
			blockID	: '#menu-inner',
		}, options);

		$(settings.buttonID + " a").click(function (e) {
			blockDisplay();
			e.preventDefault();
		});
		$(window).keydown(function (e) { //Kills the menu on esc
			if (e.keyCode == 27) {
				$(settings.blockID).slideUp();
			}
		});

		function blockDisplay() {
			$(settings.blockID).slideToggle();
			siteLayout();
		}
	}

	//takes the page back to the top
	function toTheTop() {
		$('#tothetop').click(function(e){
			e.preventDefault();
			$("html, body").animate({ scrollTop: 0 }, 800);
		});
	}

	//layout rules
	function siteLayout() {
		var winWidth = $(window).outerWidth();
		var margins = (winWidth - $("#page").outerWidth()) / 2;
		var mastheadHeight = $("#masthead").height();
		var brandingHeight = $("#masthead .site-branding").height();
		var mastheadVMargin = (mastheadHeight - brandingHeight) / 2;
		
		$("#masthead .masthead-opacity").css({'opacity' : belugaOptions.headerOpacity});
		$("#masthead .site-branding").css({'margin-top' : mastheadVMargin - 10});

		if ($(window).outerWidth() > 640 ) {

			$("#masthead").css({ "position" : "fixed",
										"top" : 0 + $("#wpadminbar").outerHeight(),
										"left" : margins,
										"width" : $("#page").outerWidth(),
										"z-index" : 0});
			$("#page").css({"padding-top" : 250});

		} else {
			if ( belugaOptions.headerOpacity < 0.4 ) {
				$("#masthead .masthead-opacity").css({'opacity' : belugaOptions.headerOpacity + 0.2});
			}
			$("#masthead").css({ "width" : $("#page").outerWidth()});
		}

		$("#tothetop").css({ "right" : margins + 8,
									"display" : "none"});
		$(".main-navigation .search-field").css({"width" : $(".main-navigation ul").innerWidth() - 22 });
	}

	//fades the masthead -- THANKS TO AlexGach
	//(http://stackoverflow.com/questions/15995623/jquery-changing-opacity-of-an-element-while-scrolling)
	function fadeMasthead() {
		if ($(window).outerWidth() > 640 ) {
			$(document).scroll(function(){
				var top = $(this).scrollTop();
				var multiplier = 300;
				if(top < multiplier){
					var dif = 1 - top / multiplier;
					$("#masthead").css({'opacity' : dif});
				}
			});
		}
	}

	//waypoint rules
	function waypointRules() {
		$("#content").waypoint(function (direction) {
			if (direction == "down") {
				$("#tothetop").fadeIn();
			} else {
				$("#tothetop").fadeOut();
			}
		});
	}

})( jQuery );