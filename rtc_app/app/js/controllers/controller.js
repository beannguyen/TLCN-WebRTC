'use strict';

var controller = angular.module('xenon.controllers', [])

    .controller('MainCtrl', function ($scope, $rootScope, $location, $layout, $state, $layoutToggles, $pageLoadingBar, $localStorage, Fullscreen) {
        $rootScope.isLoginPage = false;
        $rootScope.isLightLoginPage = false;
        $rootScope.isLockscreenPage = false;
        $rootScope.isMainPage = true;

        $rootScope.layoutOptions = {
            horizontalMenu: {
                isVisible: false,
                isFixed: true,
                minimal: false,
                clickToExpand: false,

                isMenuOpenMobile: false
            },
            sidebar: {
                isVisible: true,
                isCollapsed: true,
                toggleOthers: true,
                isFixed: true,
                isRight: false,

                isMenuOpenMobile: false,

                // Added in v1.3
                userProfile: false
            },
            chat: {
                isOpen: true,
            },
            settingsPane: {
                isOpen: false,
                useAnimation: true
            },
            container: {
                isBoxed: false
            },
            skins: {
                sidebarMenu: '',
                horizontalMenu: '',
                userInfoNavbar: ''
            },
            pageTitles: true,
            userInfoNavVisible: false
        };

        $layout.loadOptionsFromCookies(); // remove this line if you don't want to support cookies that remember layout changes


        $scope.updatePsScrollbars = function () {
            var $scrollbars = jQuery(".ps-scrollbar:visible");

            $scrollbars.each(function (i, el) {
                if (typeof jQuery(el).data('perfectScrollbar') == 'undefined') {
                    jQuery(el).perfectScrollbar();
                }
                else {
                    jQuery(el).perfectScrollbar('update');
                }
            })
        };


        // Define Public Vars
        public_vars.$body = jQuery("body");


        // Init Layout Toggles
        $layoutToggles.initToggles();


        // Other methods
        $scope.setFocusOnSearchField = function () {
            public_vars.$body.find('.search-form input[name="s"]').focus();

            setTimeout(function () {
                public_vars.$body.find('.search-form input[name="s"]').focus()
            }, 100);
        };


        // Watch changes to replace checkboxes
        $scope.$watch(function () {
            cbr_replace();
        });

        // Watch sidebar status to remove the psScrollbar
        $rootScope.$watch('layoutOptions.sidebar.isCollapsed', function (newValue, oldValue) {
            if (newValue != oldValue) {
                if (newValue == true) {
                    public_vars.$sidebarMenu.find('.sidebar-menu-inner').perfectScrollbar('destroy')
                }
                else {
                    public_vars.$sidebarMenu.find('.sidebar-menu-inner').perfectScrollbar({wheelPropagation: public_vars.wheelPropagation});
                }
            }
        });


        // Page Loading Progress (remove/comment this line to disable it)
        $pageLoadingBar.init();

        $scope.showLoadingBar = showLoadingBar;
        $scope.hideLoadingBar = hideLoadingBar;


        // Set Scroll to 0 When page is changed
        $rootScope.$on('$stateChangeStart', function () {
            var obj = {pos: jQuery(window).scrollTop()};

            TweenLite.to(obj, .25, {
                pos: 0, ease: Power4.easeOut, onUpdate: function () {
                    $(window).scrollTop(obj.pos);
                }
            });
        });


        // Full screen feature added in v1.3
        $scope.isFullscreenSupported = Fullscreen.isSupported();
        $scope.isFullscreen = Fullscreen.isEnabled() ? true : false;

        $scope.goFullscreen = function () {
            if (Fullscreen.isEnabled())
                Fullscreen.cancel();
            else
                Fullscreen.all();

            $scope.isFullscreen = Fullscreen.isEnabled() ? true : false;
        };

        // Authentication
        $rootScope.currentUser = $localStorage.currentUser;

        // logout
        $scope.logout = function () {
            $rootScope.currentUser = null;
            $state.go('access.login');
        };
    })

    .controller('WebRtcCtrl', function ($log, $scope, $rootScope, $localStorage) {
        /**
         * Start init WebRTC
         */
        var socket = io();

        var _init = function () {
            $scope.users = [];

            _setEasyRtcDefaultOptions();

            easyrtc.setPeerListener($rootScope.addToConversation);
            easyrtc.setRoomOccupantListener(_roomOccupantListener);
            easyrtc.connect("easyrtc.multipleChanel", _loginSuccess, _loginFailure);
            easyrtc.joinRoom("SectorOne", null,
                function (roomName) {
                    console.log("join to " + roomName + " successfully!");
                }, function (errorCode, errorText, roomName) {
                    console.log('Cannot join ' + roomName + ', because #', + errorCode + ': ' + errorText);
                })
        };

        var _setEasyRtcDefaultOptions = function () {
            easyrtc.enableDebug(true);
            easyrtc.enableDataChannels(true);
            easyrtc.enableVideo(false);
            easyrtc.enableAudio(false);
            easyrtc.enableVideoReceive(true);
            easyrtc.enableAudioReceive(true);
        };

        var _roomOccupantListener = function (roomName, occupants, isPrimary) {

            // do something to add user to list
        };

        var _loginSuccess = function (_easyRtcId) {
            console.log('current user', $rootScope.currentUser);
            $rootScope.currentUser.easyRtcId = _easyRtcId;
            $rootScope.currentUser.isConnected = true;
            // update local storage
            $localStorage.currentUser = $rootScope.currentUser;

            socket.emit('user logged in rtc', $rootScope.currentUser);
        };

        // when easyRtcId updated on db, load all user
        socket.on('updated easyRtcId', function (res) {
            console.log(res);
        });

        var _loginFailure = function () {
            toastr.error('Something went wrong, please login again.', 'Oops!');
        };

        _init();
    })

    .controller('LoginCtrl', function ($scope, $rootScope, $state, $localStorage) {
        $rootScope.isLoginPage = true;
        $rootScope.isMainPage = false;
        $scope.credential = {};
        $scope.uiMsg = {};
        // socket client
        var socket = io();

        $scope.login = function () {
            socket.emit('user login', $scope.credential);
        };

        // handle when user logging in
        socket.on('logging in', function (data) {

            showLoadingBar(70);
            if (data.msg === 'success') {
                $scope.$apply(function () {
                    $rootScope.currentUser = data.user;
                    $localStorage.currentUser = data.user;
                });
                $state.go('app.main');
            } else {
                $scope.$apply(function () {

                    $scope.uiMsg.warning = 'Username is incorrect';
                });
                angular.element('.alert-warning').removeClass('hidden');
                showLoadingBar(0);
            }
        })
    })
    .controller('SidebarMenuCtrl', function ($scope, $rootScope, $menuItems, $timeout, $location, $state, $layout) {

        // Menu Items
        var $sidebarMenuItems = $menuItems.instantiate();

        $scope.menuItems = $sidebarMenuItems.prepareSidebarMenu().getAll();

        // Set Active Menu Item
        $sidebarMenuItems.setActive($location.path());

        $rootScope.$on('$stateChangeSuccess', function () {
            $sidebarMenuItems.setActive($state.current.name);
        });

        // Trigger menu setup
        public_vars.$sidebarMenu = public_vars.$body.find('.sidebar-menu');
        $timeout(setup_sidebar_menu, 1);

        ps_init(); // perfect scrollbar for sidebar
    })
    .controller('HorizontalMenuCtrl', function ($scope, $rootScope, $menuItems, $timeout, $location, $state) {
        var $horizontalMenuItems = $menuItems.instantiate();

        $scope.menuItems = $horizontalMenuItems.prepareHorizontalMenu().getAll();

        // Set Active Menu Item
        $horizontalMenuItems.setActive($location.path());

        $rootScope.$on('$stateChangeSuccess', function () {
            $horizontalMenuItems.setActive($state.current.name);

            $(".navbar.horizontal-menu .navbar-nav .hover").removeClass('hover'); // Close Submenus when item is selected
        });

        // Trigger menu setup
        $timeout(setup_horizontal_menu, 1);
    })
    .controller('SettingsPaneCtrl', function ($rootScope) {
        // Define Settings Pane Public Variable
        public_vars.$settingsPane = public_vars.$body.find('.settings-pane');
        public_vars.$settingsPaneIn = public_vars.$settingsPane.find('.settings-pane-inner');
    })
    .controller('ChatCtrl', function ($scope, $element) {
        var $chat = jQuery($element),
            $chat_conv = $chat.find('.chat-conversation');

        $chat.find('.chat-inner').perfectScrollbar(); // perfect scrollbar for chat container


        // Chat Conversation Window (sample)
        $chat.on('click', '.chat-group a', function (ev) {
            ev.preventDefault();

            $chat_conv.toggleClass('is-open');

            if ($chat_conv.is(':visible')) {
                $chat.find('.chat-inner').perfectScrollbar('update');
                $chat_conv.find('textarea').autosize();
            }
        });

        $chat_conv.on('click', '.conversation-close', function (ev) {
            ev.preventDefault();

            $chat_conv.removeClass('is-open');
        });
    })
    // Added in v1.3
    .controller('FooterChatCtrl', function ($log, $scope, $rootScope, $element) {
        $scope.chatText = '';
        $scope.isConversationVisible = false;
        $scope.allMessages = [];

        $scope.toggleChatConversation = function () {
            $scope.isConversationVisible = !$scope.isConversationVisible;

            if ($scope.isConversationVisible) {
                setTimeout(function () {
                    var $el = $element.find('.ps-scrollbar');

                    if ($el.hasClass('ps-scroll-down')) {
                        $el.scrollTop($el.prop('scrollHeight'));
                    }

                    $el.perfectScrollbar({
                        wheelPropagation: false
                    });

                    $element.find('.form-control').focus();

                }, 300);
            }
        };

        $rootScope.addToConversation = function (who, msgType, content) {
            $log.debug('I am listening', who, msgType, content);
            setTimeout(function () {
                $scope.$apply(function () {
                    if (angular.isObject(content)) {
                        who = content.from;
                        content = content.msg;
                    }

                    $scope.allMessages.push({
                        text: content,
                        author: who,
                        time: moment()
                    });
                    console.log($scope.allMessages);
                }, 0);
            });
        };

        $scope.sendPublishMessage = function () {
            easyrtc.sendPeerMessage({targetRoom: 'SectorOne'}, "message", {
                msg: $scope.chatText,
                from: $rootScope.currentUser
            }, function (msgType, msgData) {
                console.log('sent your message', msgData);
            }, function (errorCode, errorText) {
                console.log('cannot send message: ', errorText);
            });
            $rootScope.addToConversation($rootScope.currentUser, "message", $scope.chatText);
            $scope.chatText = '';
        };

        // determine if this is my message
        $scope.isMyMessage = function (msg) {
            if (msg.author.username == $rootScope.currentUser.username) {
                return true;
            }
            return false;
        }
    });